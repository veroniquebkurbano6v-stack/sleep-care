/**
 * 数据库初始化脚本
 * 独立运行：node db/init.js
 * 用于第一次创建数据库或重置数据库
 * @author Developer
 * @created 2026-06-22
 */

const fs = require('fs');
const path = require('path');
const { initDatabase, closeDatabase, DB_PATH } = require('./connection');

async function main() {
    console.log('========================================');
    console.log('  睡眠评估干预系统 - 数据库初始化');
    console.log('========================================');
    console.log('目标数据库文件:', DB_PATH);

    await initDatabase();

    console.log('========================================');
    console.log('  ✓ 数据库初始化完成');
    console.log('========================================');

    closeDatabase();
    process.exit(0);
}

main().catch(err => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
});
