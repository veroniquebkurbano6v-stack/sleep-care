/**
 * SQLite → MySQL 数据迁移工具
 * 从 sql.js 的 sleep_care.db 读取数据，写入 MySQL
 *
 * 使用方式：
 *   1. 确保 MySQL 已执行 docs/migration.sql 建表
 *   2. 配置 .env 中 MySQL 连接信息（或直接修改下方配置）
 *   3. 运行: node docs/migrate-data.js
 *
 * @author Developer
 * @created 2026-06-24
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const initSqlJs = require('sql.js');

// ========== 配置 ==========
const SQLITE_DB_PATH = path.resolve(__dirname, '..', 'sleep_care.db');
const MYSQL_CONFIG = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sleep_care',
    charset: 'utf8mb4',
};

// 表名映射：SQLite → MySQL（顺序决定迁移顺序，先迁移依赖表）
const TABLES = [
    { name: 'users', pk: 'user_id' },
    { name: 'devices', pk: 'device_id' },
    { name: 'sleep_reports', pk: 'report_id' },
    { name: 'user_settings', pk: 'id' },
    { name: 'sleep_diary', pk: 'id' },
    { name: 'questionnaire_results', pk: 'id' },
    { name: 'doctor_authorizations', pk: 'id' },
];

// ========== 主流程 ==========
async function migrate() {
    console.log('\n🚀 SQLite → MySQL 数据迁移工具');
    console.log(`   SQLite: ${SQLITE_DB_PATH}`);
    console.log(`   MySQL:  ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);

    // 1. 加载 SQLite 数据库
    let sqliteDb;
    try {
        const SQL = await initSqlJs.initSqlJs({
            locateFile: file => path.join(__dirname, '..', 'backend', 'node_modules', 'sql.js', 'dist', file)
        });
        if (!fs.existsSync(SQLITE_DB_PATH)) {
            throw new Error(`SQLite 文件不存在: ${SQLITE_DB_PATH}`);
        }
        sqliteDb = new SQL.Database(fs.readFileSync(SQLITE_DB_PATH));
        console.log(`\n✅ SQLite 加载成功`);
    } catch (e) {
        console.error(`❌ SQLite 加载失败:`, e.message);
        process.exit(1);
    }

    // 2. 连接 MySQL
    let mysqlConn;
    try {
        mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
        await mysqlConn.ping();
        console.log(`✅ MySQL 连接成功\n`);
    } catch (e) {
        console.error(`❌ MySQL 连接失败:`, e.message);
        process.exit(1);
    }

    // 3. 逐表迁移
    let totalRows = 0;
    for (const table of TABLES) {
        const count = await migrateTable(sqliteDb, mysqlConn, table);
        totalRows += count;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 迁移完成！共处理 ${TABLES.length} 张表，${totalRows} 条记录`);

    // 清理
    sqliteDb.close();
    await mysqlConn.end();
}

/**
 * 迁移单张表数据
 */
async function migrateTable(sqliteDb, mysqlConn, table) {
    const { name, pk } = table;

    // 获取 SQLite 行数
    const countResult = sqliteDb.exec(`SELECT COUNT(*) AS cnt FROM ${name}`);
    const rowCount = countResult[0].values[0][0];
    if (rowCount === 0) {
        console.log(`  ⏭️  ${name}: 空表，跳过`);
        return 0;
    }

    // 获取所有列名
    const colsResult = sqliteDb.exec(`PRAGMA table_info(${name})`);
    const columns = colsResult[0].values.map(row => row[1]);

    // 获取所有数据
    const dataResult = sqliteDb.exec(`SELECT * FROM ${name}`);
    const rows = dataResult[0].values;

    // 构建 INSERT 语句
    const colList = columns.join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO \`${name}\` (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${pk}=VALUES(${pk})`;

    let success = 0;
    for (const row of rows) {
        try {
            await mysqlConn.execute(insertSql, row);
            success++;
        } catch (e) {
            // 忽略单行错误继续迁移
            console.warn(`    ⚠️  ${name} 第${success + 1}行失败: ${e.message.slice(0, 80)}`);
        }
    }

    console.log(`  ✅ ${name}: ${success}/${rowCount} 行已迁移`);
    return success;
}

// 执行
migrate().catch(err => {
    console.error('迁移异常:', err);
    process.exit(1);
});
