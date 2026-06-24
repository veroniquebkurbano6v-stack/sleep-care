/**
 * 数据库连接管理（支持 SQLite / MySQL 双模式）
 * 通过 DATABASE_TYPE 环境变量切换：sqlite(默认) | mysql
 * @author Developer
 * @created 2026-06-22
 * @updated 2026-06-24 添加 MySQL 支持 + 环境变量切换
 */

const fs = require('fs');
const path = require('path');

// 数据库类型配置，默认 SQLite
const DATABASE_TYPE = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase();

// ============ SQLite 引擎（sql.js）============
let SQL = null;
let db = null; // sql.js 内存数据库实例

// ============ MySQL 引擎（mysql2/promise）============
let mysqlPool = null;

// 通用路径/配置
const DB_DIR = path.resolve(__dirname, '..', '..');
const DB_PATH = path.join(DB_DIR, 'sleep_care.db');

/**
 * 初始化 SQL.js 引擎（SQLite 模式专用）
 * @returns {Promise<object>} sql.js 实例
 */
async function initSqlJsEngine() {
    if (SQL) return SQL;
    try {
        SQL = require('sql.js');
        SQL = await SQL.initSqlJs({
            locateFile: file => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
        });
        return SQL;
    } catch (e) {
        throw new Error('SQL.js 加载失败，请确认已安装 sql.js: npm install sql.js');
    }
}

/**
 * 初始化 MySQL 连接池（MySQL 模式专用）
 */
function initMysqlPool() {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'sleep_care',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4'
    });
    console.log(`[db] MySQL 模式已初始化 → ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE || 'sleep_care'}`);
}

let saveTimer = null;

/**
 * 把内存中的 SQLite 数据库导出并写入磁盘文件（仅 SQLite 模式）
 */
function saveDatabase() {
    if (DATABASE_TYPE !== 'sqlite' || !db) return;
    try {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
        console.error('[db] 保存数据库失败:', err.message);
    }
}

/** 防抖保存（避免高并发下反复写盘） */
function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveDatabase(); saveTimer = null; }, 100);
}

/**
 * 根据 DATABASE_TYPE 初始化对应数据库
 * - sqlite: 加载或创建 sleep_care.db
 * - mysql: 创建连接池并验证连通性
 * @returns {Promise<void>}
 */
async function initDatabase() {
    if (DATABASE_TYPE === 'mysql') {
        // ====== MySQL 模式 ======
        initMysqlPool();
        const conn = await mysqlPool.getConnection();
        await conn.ping();
        conn.release();
        console.log('[db] MySQL 连接成功');
        return;
    }

    // ====== SQLite 模式（默认）======
    await initSqlJsEngine();

    if (fs.existsSync(DB_PATH)) {
        db = new SQL.Database(fs.readFileSync(DB_PATH));
        console.log('[db] 已加载现有数据库:', DB_PATH);
    } else {
        db = new SQL.Database();
        const SCHEMA_SQL = require('./schema');
        db.exec(SCHEMA_SQL);
        saveDatabase();
        console.log('[db] 新建 SQLite 数据库并保存到:', DB_PATH);
    }

    runMigrations();
}

/**
 * 数据库迁移：确保表结构与最新 schema 一致（仅 SQLite）
 */
function runMigrations() {
    if (DATABASE_TYPE !== 'sqlite') return;
    try {
        const cols = all("PRAGMA table_info(doctor_authorizations)");
        const hasNote = cols.some(c => c.name === 'doctor_note');
        if (!hasNote) {
            db.exec('ALTER TABLE doctor_authorizations ADD COLUMN doctor_note TEXT');
            console.log('[migration] 已添加 doctor_authorizations.doctor_note 列');
            saveDatabase();
        }
    } catch (e) {
        console.warn('[migration] 迁移跳过:', e.message);
    }
}

/**
 * 获取数据库实例
 * @returns {object} SQLite Database 或 MySQL Pool 实例
 */
function getDb() {
    if (DATABASE_TYPE === 'mysql') return mysqlPool;
    if (!db) throw new Error('数据库尚未初始化，请先调用 initDatabase()');
    return db;
}

// ============ 统一查询接口（双模式兼容）============

/** MySQL 模式下执行写操作 */
async function mysqlRun(sql, params = []) {
    const conn = await mysqlPool.getConnection();
    try {
        const [result] = await conn.query(sql, params);
        return { lastID: result.insertId, changes: result.affectedRows };
    } finally { conn.release(); }
}

/** MySQL 模式下查询单条 */
async function mysqlGet(sql, params = []) {
    const conn = await mysqlPool.getConnection();
    try {
        const [rows] = await conn.query(sql, params);
        return rows[0] || null;
    } finally { conn.release(); }
}

/** MySQL 模式下查询多条 */
async function mysqlAll(sql, params = []) {
    const conn = await mysqlPool.getConnection();
    try {
        const [rows] = await conn.query(sql, params);
        return rows;
    } finally { conn.release(); }
}

/**
 * 执行 INSERT/UPDATE/DELETE，自动持久化（SQLite）或异步执行（MySQL）
 * @param {string} sql SQL 语句
 * @param {Array} params 参数列表
 * @returns {Promise<object>} 执行结果（含 lastID, changes）
 */
async function run(sql, params = []) {
    if (DATABASE_TYPE === 'mysql') return mysqlRun(sql, params);
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    const idStmt = db.prepare('SELECT last_insert_rowid() AS id, changes() AS changes');
    idStmt.step();
    const result = idStmt.getAsObject();
    idStmt.free();
    scheduleSave();
    return { lastID: result.id, changes: result.changes };
}

/**
 * 查询单条记录
 * @param {string} sql SQL 语句
 * @param {Array} params 参数列表
 * @returns {Promise<object|null>} 查询结果
 */
async function get(sql, params = []) {
    if (DATABASE_TYPE === 'mysql') return mysqlGet(sql, params);
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const hasRow = stmt.step();
    const row = hasRow ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

/**
 * 查询多条记录
 * @param {string} sql SQL 语句
 * @param {Array} params 参数列表
 * @returns {Promise<Array>} 查询结果数组
 */
async function all(sql, params = []) {
    if (DATABASE_TYPE === 'mysql') return mysqlAll(sql, params);
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (DATABASE_TYPE === 'mysql' && mysqlPool) {
        mysqlPool.end().catch(() => {});
        mysqlPool = null;
        console.log('[db] MySQL 连接池已关闭');
        return;
    }
    if (db) {
        saveDatabase();
        db.close();
        db = null;
        console.log('[db] SQLite 数据库已关闭');
    }
}

module.exports = {
    initDatabase,
    getDb,
    run,
    get,
    all,
    closeDatabase,
    saveDatabase,
    DB_PATH,
    DATABASE_TYPE
};
