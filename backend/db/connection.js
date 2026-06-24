/**
 * 数据库连接管理（基于 sql.js）
 * 负责加载/初始化 SQLite 数据库，并提供持久化能力
 * @author Developer
 * @created 2026-06-22
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const SCHEMA_SQL = require('./schema');

// 数据库文件路径：项目根目录
const DB_DIR = path.resolve(__dirname, '..', '..');
const DB_PATH = path.join(DB_DIR, 'sleep_care.db');

// 内存中的数据库实例（sql.js 的数据库本身在内存中）
let db = null;
let SQL = null;
let saveTimer = null;

/**
 * 初始化 SQL.js 引擎
 * @returns {Promise<void>}
 */
async function initSqlJsEngine() {
    if (SQL) return SQL;
    SQL = await initSqlJs({
        // 显式指定 wasm 路径，避免某些环境下找不到
        locateFile: file => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
    });
    return SQL;
}

/**
 * 把内存中的数据库导出并写入磁盘文件
 */
function saveDatabase() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error('[db] 保存数据库失败:', err.message);
    }
}

/**
 * 防抖保存（避免高并发下反复写盘）
 */
function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveDatabase();
        saveTimer = null;
    }, 100);
}

/**
 * 初始化数据库：若本地有 db 文件则加载，否则创建空库并执行 schema
 * @returns {Promise<object>} 数据库实例
 */
async function initDatabase() {
    await initSqlJsEngine();

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log('[db] 已加载现有数据库:', DB_PATH);
    } else {
        db = new SQL.Database();
        console.log('[db] 新建内存数据库，开始执行 schema...');
        db.exec(SCHEMA_SQL);
        saveDatabase();
        console.log('[db] 数据库已初始化并保存到:', DB_PATH);
    }

    // 执行数据库迁移
    runMigrations();

    return db;
}

/**
 * 数据库迁移：确保表结构与最新 schema 一致
 */
function runMigrations() {
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
 * 获取数据库实例（必须先调用 initDatabase）
 * @returns {object} sql.js Database 实例
 */
function getDb() {
    if (!db) {
        throw new Error('数据库尚未初始化，请先调用 initDatabase()');
    }
    return db;
}

/**
 * 执行 INSERT/UPDATE/DELETE，自动持久化
 * @param {string} sql SQL 语句
 * @param {Array} params 参数列表
 * @returns {object} 执行结果（含 lastID, changes）
 */
function run(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    // sql.js 不会自动返回 lastID/changes，需要单独查询
    const idStmt = db.prepare('SELECT last_insert_rowid() AS id, changes() AS changes');
    idStmt.step();
    const result = idStmt.getAsObject();
    idStmt.free();
    scheduleSave();
    return {
        lastID: result.id,
        changes: result.changes
    };
}

/**
 * 查询单条记录
 * @param {string} sql SQL 语句
 * @param {Array} params 参数列表
 * @returns {object|null} 查询结果
 */
function get(sql, params = []) {
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
 * @returns {Array} 查询结果数组
 */
function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

/**
 * 关闭数据库（保存并释放资源）
 */
function closeDatabase() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (db) {
        saveDatabase();
        db.close();
        db = null;
        console.log('[db] 数据库已关闭');
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
    DB_PATH
};
