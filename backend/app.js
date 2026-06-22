/**
 * 睡眠评估干预系统 - Express 后端入口
 * 负责启动 HTTP 服务并暴露注册/登录接口
 * @author Developer
 * @created 2026-06-22
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { initDatabase, get, run, all, closeDatabase, saveDatabase } = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sleep_care_default_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ============ 中间件 ============
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ 统一响应工具 ============
/**
 * 业务成功响应
 * @param {object} res Express 响应对象
 * @param {object} data 业务数据
 * @param {string} message 提示信息
 */
function ok(res, data = null, message = 'success') {
    return res.json({ code: 0, message, data });
}

/**
 * 业务失败响应
 * @param {object} res Express 响应对象
 * @param {string} message 错误信息
 * @param {number} code 业务错误码（非0）
 * @param {number} httpStatus HTTP 状态码
 */
function fail(res, message = 'error', code = 1, httpStatus = 200) {
    return res.status(httpStatus).json({ code, message, data: null });
}

// ============ 根路由 ============
app.get('/', (req, res) => {
    ok(res, {
        name: 'sleep-care-backend',
        version: '1.0.0',
        endpoints: [
            'POST /api/v1/auth/register',
            'POST /api/v1/auth/login',
            'GET  /api/v1/users/me',
            'GET  /api/v1/devices/list',
            'POST /api/v1/devices/add',
            'PUT  /api/v1/devices/:id',
            'DELETE /api/v1/devices/:id'
        ]
    }, 'Sleep Care Backend is running');
});

// ============ 注册接口 ============
/**
 * POST /api/v1/auth/register
 * Body: { phone, password, nickname?, gender?, birth_year? }
 */
app.post('/api/v1/auth/register', async (req, res) => {
    try {
        const { phone, password, nickname, gender, birth_year } = req.body || {};

        // 参数校验
        if (!phone || typeof phone !== 'string' || phone.length < 5) {
            return fail(res, '手机号格式不正确', 400);
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return fail(res, '密码至少6位', 400);
        }

        // 检查手机号是否已注册
        const existing = get('SELECT user_id FROM users WHERE phone = ?', [phone]);
        if (existing) {
            return fail(res, '该手机号已注册', 409);
        }

        // 加密密码
        const passwordHash = await bcrypt.hash(password, 10);

        // 插入新用户
        const result = run(
            `INSERT INTO users (phone, nickname, avatar_url, gender, birth_year, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
            [
                phone,
                nickname || '用户',
                null,
                Number.isInteger(gender) ? gender : 0,
                birth_year ? Number(birth_year) : null,
                passwordHash
            ]
        );

        // 同时为新用户创建默认设置
        run(
            `INSERT INTO user_settings (user_id) VALUES (?)`,
            [result.lastID]
        );

        // 返回结果（不包含密码哈希）
        const newUser = get(
            'SELECT user_id, phone, nickname, gender, birth_year, role, status, created_at FROM users WHERE user_id = ?',
            [result.lastID]
        );

        return ok(res, { user: newUser }, '注册成功');
    } catch (err) {
        console.error('[register] error:', err);
        return fail(res, '服务器内部错误', 500, 500);
    }
});

// ============ 登录接口 ============
/**
 * POST /api/v1/auth/login
 * Body: { phone, password }
 */
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { phone, password } = req.body || {};

        // 参数校验
        if (!phone || !password) {
            return fail(res, '手机号和密码不能为空', 400);
        }

        // 查询用户
        const user = get(
            'SELECT user_id, phone, nickname, password_hash, role, status FROM users WHERE phone = ?',
            [phone]
        );

        if (!user) {
            return fail(res, '用户不存在', 404);
        }

        // 检查账户状态
        if (user.status === 1) {
            return fail(res, '账户已被禁用', 403);
        }

        // 验证密码
        const passwordOk = await bcrypt.compare(password, user.password_hash);
        if (!passwordOk) {
            return fail(res, '密码错误', 401);
        }

        // 生成 JWT
        const token = jwt.sign(
            {
                user_id: user.user_id,
                phone: user.phone,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return ok(res, {
            token,
            user: {
                user_id: user.user_id,
                phone: user.phone,
                nickname: user.nickname,
                role: user.role
            }
        }, '登录成功');
    } catch (err) {
        console.error('[login] error:', err);
        return fail(res, '服务器内部错误', 500, 500);
    }
});

// ============ JWT 鉴权中间件 ============
/**
 * 校验 Authorization 头中的 Bearer token
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return fail(res, '未提供 token', 401, 401);
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return fail(res, 'token 无效或已过期', 401, 401);
    }
}

// ============ 受保护示例接口 ============
app.get('/api/v1/users/me', authMiddleware, (req, res) => {
    const user = get(
        'SELECT user_id, phone, nickname, gender, birth_year, role, status, created_at FROM users WHERE user_id = ?',
        [req.user.user_id]
    );
    if (!user) {
        return fail(res, '用户不存在', 404);
    }
    return ok(res, { user });
});

// ============ 设备管理 CRUD 接口 ============

/**
 * 生成虚拟设备序列号（VIR + 16位随机字符）
 * @returns {string} 格式：VIR + 16位十六进制
 */
function generateVirtualSerialNo() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'VIR';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 生成设备ID（32位字符串）
 * @returns {string}
 */
function generateDeviceId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 24; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'DEV_' + result;
}

// GET /api/v1/devices/list - 查询当前用户的设备列表（按 created_at 降序）
app.get('/api/v1/devices/list', authMiddleware, (req, res) => {
    try {
        const devices = all(
            `SELECT device_id, serial_no, name, is_virtual, firmware_version,
                    last_active_time, created_at, updated_at
             FROM devices WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.user.user_id]
        );
        return ok(res, { list: devices });
    } catch (err) {
        console.error('[devices/list] error:', err);
        return fail(res, '查询设备列表失败', 500, 500);
    }
});

// POST /api/v1/devices/add - 添加设备（支持虚拟设备）
app.post('/api/v1/devices/add', authMiddleware, async (req, res) => {
    try {
        const { name, is_virtual } = req.body || {};
        const virtual = Number.isInteger(is_virtual) ? is_virtual : 0;

        // 参数校验
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return fail(res, '设备名称不能为空', 400);
        }

        // 检查用户设备数量上限（最多10台）
        const countResult = get('SELECT COUNT(*) AS cnt FROM devices WHERE user_id = ?', [req.user.user_id]);
        if (countResult && countResult.cnt >= 10) {
            return fail(res, '设备数量已达上限（10台）', 400);
        }

        // 生成设备信息
        const deviceId = generateDeviceId();
        let serialNo;

        if (virtual === 1) {
            serialNo = generateVirtualSerialNo(); // VIR + 16位
        } else {
            serialNo = generateDeviceId().replace('DEV_', 'REAL_');
        }

        // 插入设备记录
        run(
            `INSERT INTO devices (device_id, user_id, serial_no, name, is_virtual, firmware_version)
             VALUES (?, ?, ?, ?, ?, 'V1.0.0')`,
            [deviceId, req.user.user_id, serialNo, name.trim(), virtual]
        );

        // 立即保存数据库
        saveDatabase();

        // 返回新创建的设备
        const newDevice = get(
            `SELECT device_id, serial_no, name, is_virtual, firmware_version,
                    last_active_time, created_at, updated_at
             FROM devices WHERE device_id = ?`,
            [deviceId]
        );

        return ok(res, { device: newDevice }, '设备添加成功');
    } catch (err) {
        console.error('[devices/add] error:', err);
        return fail(res, '添加设备失败', 500, 500);
    }
});

// PUT /api/v1/devices/:id - 更新设备信息
app.put('/api/v1/devices/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body || {};

        // 参数校验
        if (!id || typeof id !== 'string' || id.trim() === '') {
            return fail(res, '设备ID不能为空', 400);
        }
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return fail(res, '设备名称不能为空', 400);
        }

        // 验证设备归属
        const device = get(
            'SELECT device_id FROM devices WHERE device_id = ? AND user_id = ?',
            [id.trim(), req.user.user_id]
        );
        if (!device) {
            return fail(res, '设备不存在或无权操作', 404);
        }

        // 执行更新
        run(
            "UPDATE devices SET name = ?, updated_at = datetime('now') WHERE device_id = ?",
            [name.trim(), id.trim()]
        );

        // 立即保存数据库
        saveDatabase();

        // 返回更新后的设备
        const updatedDevice = get(
            `SELECT device_id, serial_no, name, is_virtual, firmware_version,
                    last_active_time, created_at, updated_at
             FROM devices WHERE device_id = ?`,
            [id.trim()]
        );

        return ok(res, { device: updatedDevice }, '设备更新成功');
    } catch (err) {
        console.error('[devices/update] error:', err);
        return fail(res, '更新设备失败', 500, 500);
    }
});

// DELETE /api/v1/devices/:id - 删除设备
app.delete('/api/v1/devices/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // 参数校验
        if (!id || typeof id !== 'string' || id.trim() === '') {
            return fail(res, '设备ID不能为空', 400);
        }

        // 验证设备归属
        const device = get(
            'SELECT device_id FROM devices WHERE device_id = ? AND user_id = ?',
            [id.trim(), req.user.user_id]
        );
        if (!device) {
            return fail(res, '设备不存在或无权操作', 404);
        }

        // 执行删除
        run('DELETE FROM devices WHERE device_id = ? AND user_id = ?', [id.trim(), req.user.user_id]);

        // 立即保存数据库
        saveDatabase();

        return ok(res, null, '设备删除成功');
    } catch (err) {
        console.error('[devices/delete] error:', err);
        return fail(res, '删除设备失败', 500, 500);
    }
});

// ============ 全局错误处理 ============
app.use((err, req, res, next) => {
    console.error('[global error]', err);
    fail(res, '服务器内部错误', 500, 500);
});

// ============ 404 处理 ============
app.use((req, res) => {
    fail(res, `路由不存在: ${req.method} ${req.path}`, 404, 404);
});

// ============ 启动服务 ============
async function start() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log('========================================');
            console.log('  睡眠评估干预系统 - 后端服务已启动');
            console.log(`  监听端口: ${PORT}`);
            console.log(`  访问地址: http://localhost:${PORT}`);
            console.log('========================================');
        });
    } catch (err) {
        console.error('服务启动失败:', err);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', () => {
    closeDatabase();
    process.exit(0);
});

start();
