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

const { initDatabase, get, run, all, closeDatabase, saveDatabase, getDb } = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sleep_care_default_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ============ 中间件 ============
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
            'DELETE /api/v1/devices/:id',
            'GET  /api/sleep/report/daily',
            'GET  /api/sleep/stages',
            'GET  /api/sleep/noise',
            'GET  /api/sleep/summary'
        ]
    }, 'Sleep Care Backend is running');
});

// ============ 注册接口 ============
/**
 * POST /api/v1/auth/register
 * Body: { phone, password, nickname?, gender?, birth_year?, role? }
 * role: 0=patient(默认), 1=doctor
 */
app.post('/api/v1/auth/register', async (req, res) => {
    try {
        const { phone, password, nickname, gender, birth_year, role } = req.body || {};

        // 参数校验
        if (!phone || typeof phone !== 'string' || phone.length < 5) {
            return fail(res, '手机号格式不正确', 400);
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return fail(res, '密码至少6位', 400);
        }

        // 检查手机号是否已注册
        const existing = await get('SELECT user_id FROM users WHERE phone = ?', [phone]);
        if (existing) {
            return fail(res, '该手机号已注册', 409);
        }

        // 加密密码
        const passwordHash = await bcrypt.hash(password, 10);

        // 角色默认为 patient(0)，仅接受 0 或 1
        const userRole = Number.isInteger(role) ? (role === 1 ? 1 : 0) : 0;

        // 插入新用户
        const result = await run(
            `INSERT INTO users (phone, nickname, avatar_url, gender, birth_year, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                phone,
                nickname || '用户',
                null,
                Number.isInteger(gender) ? gender : 0,
                birth_year ? Number(birth_year) : null,
                passwordHash,
                userRole
            ]
        );

        // 同时为新用户创建默认设置
        await run(
            `INSERT INTO user_settings (user_id) VALUES (?)`,
            [result.lastID]
        );

        // 返回结果（不包含密码哈希）
        const newUser = await get(
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
        const user = await get(
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
app.get('/api/v1/users/me', authMiddleware, async (req, res) => {
    const user = await get(
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
app.get('/api/v1/devices/list', authMiddleware, async (req, res) => {
    try {
        const devices = await all(
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
        const countResult = await get('SELECT COUNT(*) AS cnt FROM devices WHERE user_id = ?', [req.user.user_id]);
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
        await run(
            `INSERT INTO devices (device_id, user_id, serial_no, name, is_virtual, firmware_version)
             VALUES (?, ?, ?, ?, ?, 'V1.0.0')`,
            [deviceId, req.user.user_id, serialNo, name.trim(), virtual]
        );

        // 立即保存数据库
        saveDatabase();

        // 返回新创建的设备
        const newDevice = await get(
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
        const device = await get(
            'SELECT device_id FROM devices WHERE device_id = ? AND user_id = ?',
            [id.trim(), req.user.user_id]
        );
        if (!device) {
            return fail(res, '设备不存在或无权操作', 404);
        }

        // 执行更新
        await run(
            "UPDATE devices SET name = ?, updated_at = NOW() WHERE device_id = ?",
            [name.trim(), id.trim()]
        );

        // 立即保存数据库
        saveDatabase();

        // 返回更新后的设备
        const updatedDevice = await get(
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
        const device = await get(
            'SELECT device_id FROM devices WHERE device_id = ? AND user_id = ?',
            [id.trim(), req.user.user_id]
        );
        if (!device) {
            return fail(res, '设备不存在或无权操作', 404);
        }

        // 执行删除
        await run('DELETE FROM devices WHERE device_id = ? AND user_id = ?', [id.trim(), req.user.user_id]);

        // 立即保存数据库
        saveDatabase();

        return ok(res, null, '设备删除成功');
    } catch (err) {
        console.error('[devices/delete] error:', err);
        return fail(res, '删除设备失败', 500, 500);
    }
});

// ============ 睡眠评分汇总接口（懒加载补全） ============

/**
 * 查询或生成指定日期的睡眠评分（懒加载补全核心函数）
 * 若该日期无报告，则自动生成并持久化到数据库
 * @param {number} userId 用户ID
 * @param {string} date 日期 YYYY-MM-DD
 * @returns {object} 包含 sleep_score 的报告对象
 */
async function getOrCreateDailyScore(userId, date) {
    // 步骤1：查询该日期是否已有报告
    const existing = await get(
        'SELECT sleep_score FROM sleep_reports WHERE user_id = ? AND report_date = ?',
        [userId, date]
    );

    if (existing) {
        return existing;
    }

    // 步骤2：无报告则获取用户设备
    let device = await get(
        'SELECT device_id FROM devices WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
    );

    // 若无设备则自动创建虚拟设备
    if (!device) {
        const autoDeviceId = generateDeviceId();
        const autoSerialNo = generateVirtualSerialNo();
        await run(
            `INSERT INTO devices (device_id, user_id, serial_no, name, is_virtual, firmware_version)
             VALUES (?, ?, ?, '默认睡眠监测设备', 1, 'V1.0.0')`,
            [autoDeviceId, userId, autoSerialNo]
        );
        device = { device_id: autoDeviceId };
    }

    // 步骤3：生成模拟数据并插入
    const seed = `${userId}_${device.device_id}_${date}`;
    const mockData = generateMockSleepData(seed);

    await run(
        `INSERT INTO sleep_reports (
            user_id, device_id, report_date, sleep_score,
            total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes,
            light_sleep_minutes, awake_minutes, awake_count, avg_heart_rate,
            heart_rate_json, respiration_json, sleep_stages_json, noise_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId, device.device_id, date, mockData.sleep_score,
            mockData.total_sleep_minutes, mockData.deep_sleep_minutes,
            mockData.rem_sleep_minutes, mockData.light_sleep_minutes,
            mockData.awake_minutes, mockData.awake_count,
            mockData.avg_heart_rate, mockData.heart_rate_json,
            mockData.respiration_json, mockData.sleep_stages_json,
            mockData.noise_json,
        ]
    );

    // 步骤4：立即持久化
    saveDatabase();

    // 步骤5：返回新创建的评分
    return { sleep_score: mockData.sleep_score };
}

/**
 * GET /api/sleep/summary - 睡眠评分汇总接口
 * Query: period (day/week/month)
 * 返回：labels（日期标签）、scores（评分数组）、avg_score（平均分）
 */
app.get('/api/sleep/summary', authMiddleware, async (req, res) => {
    try {
        const { period } = req.query || {};
        const periodType = period || 'day';

        // 参数校验
        if (!['day', 'week', 'month'].includes(periodType)) {
            return fail(res, 'period 参数错误，仅支持 day/week/month', 400);
        }

        const userId = req.user.user_id;
        const labels = [];
        const scores = [];

        if (periodType === 'day') {
            // 日视图：最近7天
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().slice(0, 10);
                labels.push(dateStr.slice(5)); // MM-DD格式

                // 查询或生成该日期的评分（懒加载补全）
                const report = await getOrCreateDailyScore(userId, dateStr);
                scores.push(report.sleep_score);
            }
        } else if (periodType === 'week') {
            // 周视图：最近6周
            for (let i = 5; i >= 0; i--) {
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);

                const label = `第${6 - i}周`;
                labels.push(label);

                // 计算该周的平均评分
                let weekScores = [];
                for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().slice(0, 10);
                    const report = await getOrCreateDailyScore(userId, dateStr);
                    weekScores.push(report.sleep_score);
                }

                const avgWeek = Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length);
                scores.push(avgWeek);
            }
        } else if (periodType === 'month') {
            // 月视图：最近6个月
            for (let i = 5; i >= 0; i--) {
                const monthDate = new Date();
                monthDate.setMonth(monthDate.getMonth() - i);
                const year = monthDate.getFullYear();
                const month = monthDate.getMonth() + 1;

                const label = `${year}-${String(month).padStart(2, '0')}`;
                labels.push(label);

                // 计算该月的平均评分
                const daysInMonth = new Date(year, month, 0).getDate();
                let monthScores = [];

                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const report = await getOrCreateDailyScore(userId, dateStr);
                    monthScores.push(report.sleep_score);
                }

                const avgMonth = Math.round(monthScores.reduce((a, b) => a + b, 0) / monthScores.length);
                scores.push(avgMonth);
            }
        }

        // 计算整体平均分
        const avgScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

        return ok(res, {
            period: periodType,
            labels,
            scores,
            avg_score: avgScore,
        });
    } catch (err) {
        console.error('[sleep/summary] error:', err);
        return fail(res, '获取睡眠评分汇总失败', 500, 500);
    }
});

// ============ 睡眠报告接口 ============

/**
 * 确定性伪随机数生成器（基于种子）
 * 同一用户+同一设备+同一天 → 结果完全一致
 * @param {string} seed 种子字符串
 * @returns {function} 返回一个 [0,1) 范围的伪随机函数
 */
function seededRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // 转为32位整数
    }
    return function () {
        // Mulberry32 algorithm
        hash += 0x6D2B79F5;
        let t = hash;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * 根据种子生成模拟睡眠数据
 * 数据符合生理规律：总睡眠 360-480 分钟，深睡占比 13-23%，REM 占比 18-25%
 * @param {string} seed 种子（user_id + device_id + date）
 * @returns {object} 模拟的睡眠报告数据
 */
function generateMockSleepData(seed) {
    const rng = seededRandom(seed);

    // 总睡眠时长：360-480 分钟（6-8小时），偏向正常分布
    const totalMin = Math.floor(380 + rng() * 100);

    // 各阶段比例（深睡 13-23%，REM 18-25%，浅睡 40-55%）
    const deepRatio = 0.13 + rng() * 0.10;
    const remRatio = 0.18 + rng() * 0.07;
    const lightRatio = 0.42 + rng() * 0.13;

    // 归一化确保总和为 totalMin
    const rawTotal = deepRatio + remRatio + lightRatio;
    const deepMin = Math.round(totalMin * (deepRatio / rawTotal));
    const remMin = Math.round(totalMin * (remRatio / rawTotal));
    const lightMin = totalMin - deepMin - remMin;

    // 觉醒时间：10-45 分钟
    const awakeMin = Math.floor(12 + rng() * 33);

    // 觉醒次数：2-8 次
    const awakeCount = Math.floor(2 + rng() * 7);

    // 平均心率：58-72 bpm
    const avgHR = Math.round((58 + rng() * 14) * 100) / 100;

    // 睡眠评分：根据各阶段质量计算（60-95分）
    const qualityScore = Math.min(95, Math.max(
        50,
        Math.round(70 - awakeCount * 3 + (deepRatio * 80) + (remRatio * 30))
    ));

    // 生成心率曲线（每分钟一个点，采样为每小时一个点）
    const heartRateCurve = [];
    for (let i = 0; i < totalMin; i += 60) {
        heartRateCurve.push(Math.round(avgHR + (rng() - 0.5) * 8));
    }

    // 生成睡眠阶段序列（每30秒一个值：0=清醒,1=浅睡,2=深睡,3=REM）
    const stageCurve = [];
    const totalEpochs = Math.floor(totalMin * 2); // 每30秒一个epoch
    let currentStage = 1; // 从浅睡开始
    for (let i = 0; i < totalEpochs; i++) {
        if (i < 20) { stageCurve.push(0); continue; } // 前10分钟清醒（入睡潜伏期）
        // 阶段转移概率模型
        const r = rng();
        if (currentStage === 1 && r < 0.08) { currentStage = 2; }
        else if (currentStage === 2 && r < 0.06) { currentStage = 3; }
        else if (currentStage === 3 && r < 0.05) { currentStage = 1; }
        else if (currentStage === 1 && r < 0.03) { currentStage = 0; } // 偶尔觉醒
        else if (currentStage === 0 && r < 0.85) { currentStage = 1; }
        stageCurve.push(currentStage);
    }

    // 噪音曲线（每小时一个点，单位 dB）
    const noiseCurve = [];
    for (let i = 0; i < 24; i++) {
        noiseCurve.push(Math.round(28 + rng() * 22));
    }

    return {
        sleep_score: qualityScore,
        total_sleep_minutes: totalMin,
        deep_sleep_minutes: deepMin,
        rem_sleep_minutes: remMin,
        light_sleep_minutes: lightMin,
        awake_minutes: awakeMin,
        awake_count: awakeCount,
        avg_heart_rate: avgHR,
        heart_rate_json: JSON.stringify(heartRateCurve),
        respiration_json: JSON.stringify(heartRateCurve.map(hr => Math.round(hr / 4))),
        sleep_stages_json: JSON.stringify(stageCurve),
        noise_json: JSON.stringify(noiseCurve),
    };
}

// GET /api/sleep/report/daily - 查询/生成每日睡眠报告（先查后插模式）
app.get('/api/sleep/report/daily', authMiddleware, async (req, res) => {
    try {
        const { date } = req.query || {};
        const reportDate = date || new Date().toISOString().slice(0, 10); // 默认今天

        // 参数校验：日期格式 YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
            return fail(res, '日期格式错误，请使用 YYYY-MM-DD', 400);
        }

        // 步骤1：查询该用户是否已有该日期的报告
        const existingReport = await get(
            `SELECT report_id, user_id, device_id, report_date, sleep_score,
                    total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes,
                    light_sleep_minutes, awake_minutes, awake_count, avg_heart_rate,
                    heart_rate_json, sleep_stages_json, noise_json, created_at
             FROM sleep_reports WHERE user_id = ? AND report_date = ?`,
            [req.user.user_id, reportDate]
        );

        // 步骤2：如果存在，直接返回
        if (existingReport) {
            return ok(res, { report: existingReport });
        }

        // 步骤3：不存在则获取用户的一台设备作为关联设备
        let device = await get(
            'SELECT device_id FROM devices WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [req.user.user_id]
        );

        // 若无绑定设备，自动创建一台虚拟设备（确保首页可直接使用）
        if (!device) {
            const autoDeviceId = generateDeviceId();
            const autoSerialNo = generateVirtualSerialNo();
            await run(
                `INSERT INTO devices (device_id, user_id, serial_no, name, is_virtual, firmware_version)
                 VALUES (?, ?, ?, '默认睡眠监测设备', 1, 'V1.0.0')`,
                [autoDeviceId, req.user.user_id, autoSerialNo]
            );
            device = { device_id: autoDeviceId };
        }

        // 步骤4：使用确定性伪随机函数生成模拟数据
        // 种子 = user_id + device_id + date，保证同一用户同一设备同一天结果完全一致
        const seed = `${req.user.user_id}_${device.device_id}_${reportDate}`;
        const mockData = generateMockSleepData(seed);

        // 步骤5：插入数据库
        await run(
            `INSERT INTO sleep_reports (
                user_id, device_id, report_date, sleep_score,
                total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes,
                light_sleep_minutes, awake_minutes, awake_count, avg_heart_rate,
                heart_rate_json, respiration_json, sleep_stages_json, noise_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.user_id,
                device.device_id,
                reportDate,
                mockData.sleep_score,
                mockData.total_sleep_minutes,
                mockData.deep_sleep_minutes,
                mockData.rem_sleep_minutes,
                mockData.light_sleep_minutes,
                mockData.awake_minutes,
                mockData.awake_count,
                mockData.avg_heart_rate,
                mockData.heart_rate_json,
                mockData.respiration_json,
                mockData.sleep_stages_json,
                mockData.noise_json,
            ]
        );

        // 步骤6：立即持久化到磁盘
        saveDatabase();

        // 步骤7：查询并返回新创建的报告
        const newReport = await get(
            `SELECT report_id, user_id, device_id, report_date, sleep_score,
                    total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes,
                    light_sleep_minutes, awake_minutes, awake_count, avg_heart_rate,
                    heart_rate_json, sleep_stages_json, noise_json, created_at
             FROM sleep_reports WHERE user_id = ? AND report_date = ?`,
            [req.user.user_id, reportDate]
        );

        return ok(res, { report: newReport }, '睡眠报告已生成');
    } catch (err) {
        console.error('[sleep/report/daily] error:', err);
        return fail(res, '获取睡眠报告失败', 500, 500);
    }
});

// ============ 睡眠分期接口 ============

/**
 * 生成48个睡眠分期数据点（符合生理规律）
 * 编码：0=清醒, 1=浅睡, 2=深睡, 3=REM
 * 规律：前半夜深睡多，后半夜REM多
 * @param {function} rng 确定性伪随机函数
 * @returns {number[]} 长度为48的数组
 */
function generateSleepStages(rng) {
    const stages = [];
    // 将8小时睡眠分为48个时段（每段10分钟）
    for (let i = 0; i < 48; i++) {
        const progress = i / 47; // 0（入睡）→ 1（醒来）
        const r = rng();

        if (progress < 0.05) {
            // 入睡期：清醒→浅睡
            stages.push(r < 0.6 ? 0 : 1);
        } else if (progress < 0.25) {
            // 前半夜：深睡为主（N3慢波睡眠高峰）
            if (r < 0.55) stages.push(2);       // 深睡55%
            else if (r < 0.85) stages.push(1);   // 浅睡30%
            else stages.push(3);                  // REM 15%
        } else if (progress < 0.50) {
            // 中半夜：深睡减少，浅睡和REM增加
            if (r < 0.35) stages.push(2);       // 深睡35%
            else if (r < 0.70) stages.push(1);   // 浅睡35%
            else if (r < 0.95) stages.push(3);   // REM 25%
            else stages.push(0);                  // 偶尔觉醒5%
        } else if (progress < 0.75) {
            // 后半夜：REM增多，深睡减少
            if (r < 0.15) stages.push(2);       // 深睡15%
            else if (r < 0.50) stages.push(1);   // 浅睡35%
            else if (r < 0.92) stages.push(3);   // REM 42%
            else stages.push(0);                  // 偶尔觉醒8%
        } else {
            // 接近醒来：觉醒增加，REM仍较多
            if (r < 0.05) stages.push(2);       // 偶尔深睡5%
            else if (r < 0.40) stages.push(1);   // 浅睡35%
            else if (r < 0.80) stages.push(3);   // REM 40%
            else stages.push(0);                  // 觉醒20%
        }
    }
    return stages;
}

// GET /api/sleep/stages - 获取/生成睡眠分期数据（48个数据点，先查后插模式）
app.get('/api/sleep/stages', authMiddleware, async (req, res) => {
    try {
        const { date } = req.query || {};
        const reportDate = date || new Date().toISOString().slice(0, 10);

        // 参数校验
        if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
            return fail(res, '日期格式错误，请使用 YYYY-MM-DD', 400);
        }

        // 步骤1：查询该用户该日期的报告
        const existingReport = await get(
            `SELECT report_id, device_id, sleep_stages_json FROM sleep_reports WHERE user_id = ? AND report_date = ?`,
            [req.user.user_id, reportDate]
        );

        let stages;

        if (existingReport && existingReport.sleep_stages_json) {
            // 已有分期数据，直接解析返回
            stages = JSON.parse(existingReport.sleep_stages_json);
        } else {
            // 无报告或无分期数据 → 生成48个分期数据点
            const seed = `${req.user.user_id}_${reportDate}_stages`;
            const rng = seededRandom(seed);
            stages = generateSleepStages(rng);

            if (existingReport) {
                // 有报告但无分期数据 → UPDATE
                await run(
                    'UPDATE sleep_reports SET sleep_stages_json = ? WHERE report_id = ?',
                    [JSON.stringify(stages), existingReport.report_id]
                );
            } else {
                // 无报告 → 获取设备并插入完整报告
                let device = await get(
                    'SELECT device_id FROM devices WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                    [req.user.user_id]
                );
                if (!device) {
                    const autoDeviceId = generateDeviceId();
                    const autoSerialNo = generateVirtualSerialNo();
                    await run(
                        `INSERT INTO devices (device_id, user_id, serial_no, name, is_virtual, firmware_version)
                         VALUES (?, ?, ?, '默认睡眠监测设备', 1, 'V1.0.0')`,
                        [autoDeviceId, req.user.user_id, autoSerialNo]
                    );
                    device = { device_id: autoDeviceId };
                }

                const mockData = generateMockSleepData(`${req.user.user_id}_${device.device_id}_${reportDate}`);
                mockData.sleep_stages_json = JSON.stringify(stages);
                await run(
                    `INSERT INTO sleep_reports (
                        user_id, device_id, report_date, sleep_score,
                        total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes,
                        light_sleep_minutes, awake_minutes, awake_count, avg_heart_rate,
                        heart_rate_json, respiration_json, sleep_stages_json, noise_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        req.user.user_id, device.device_id, reportDate,
                        mockData.sleep_score, mockData.total_sleep_minutes,
                        mockData.deep_sleep_minutes, mockData.rem_sleep_minutes,
                        mockData.light_sleep_minutes, mockData.awake_minutes,
                        mockData.awake_count, mockData.avg_heart_rate,
                        mockData.heart_rate_json, mockData.respiration_json,
                        mockData.sleep_stages_json, mockData.noise_json,
                    ]
                );
            }

            saveDatabase();
        }

        return ok(res, {
            date: reportDate,
            total_points: stages.length,
            stages: stages,
            encoding: '0=清醒, 1=浅睡, 2=深睡, 3=REM',
        });
    } catch (err) {
        console.error('[sleep/stages] error:', err);
        return fail(res, '获取睡眠分期数据失败', 500, 500);
    }
});

// ============ 噪音数据接口 ============

/**
 * 生成144个噪音数据点（每10分钟一个点，共24小时）
 * 规则：夜间 22:00-06:00 为 30-40dB，白天 06:00-22:00 为 45-65dB，含平滑过渡
 * @param {function} rng 确定性伪随机函数
 * @returns {number[]} 长度为144的数组（单位：dB）
 */
function generateNoiseData(rng) {
    const data = [];
    for (let i = 0; i < 144; i++) {
        // 每个点代表10分钟，144个点=24小时（从0:00开始）
        const hourOfDay = Math.floor(i / 6) + (i % 6 / 6); // 精确到分钟的小时数
        const r = rng();

        if (hourOfDay >= 22 || hourOfDay < 6) {
            // 夜间 22:00-06:00：30-40dB
            data.push(Math.round(30 + r * 10));
        } else if (hourOfDay < 7 || hourOfDay >= 21) {
            // 过渡期 06:00-07:00 / 21:00-22:00：35-50dB 平滑过渡
            data.push(Math.round(35 + r * 15));
        } else {
            // 白天 07:00-21:00：45-65dB
            data.push(Math.round(45 + r * 20));
        }
    }
    return data;
}

// GET /api/sleep/noise - 获取/生成噪音数据（144个数据点，先查后插模式）
app.get('/api/sleep/noise', authMiddleware, async (req, res) => {
    try {
        const { date } = req.query || {};
        const reportDate = date || new Date().toISOString().slice(0, 10);

        // 参数校验
        if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
            return fail(res, '日期格式错误，请使用 YYYY-MM-DD', 400);
        }

        // 步骤1：查询该用户该日期的报告
        const existingReport = await get(
            `SELECT report_id, device_id, noise_json FROM sleep_reports WHERE user_id = ? AND report_date = ?`,
            [req.user.user_id, reportDate]
        );

        let noiseData;

        if (existingReport && existingReport.noise_json) {
            // 已有噪音数据，直接解析返回
            noiseData = JSON.parse(existingReport.noise_json);
        } else {
            // 无报告或无噪音数据 → 生成144个噪音数据点
            const seed = `${req.user.user_id}_${reportDate}_noise`;
            const rng = seededRandom(seed);
            noiseData = generateNoiseData(rng);

            if (existingReport) {
                // 有报告但无噪音数据 → UPDATE
                await run(
                    'UPDATE sleep_reports SET noise_json = ? WHERE report_id = ?',
                    [JSON.stringify(noiseData), existingReport.report_id]
                );
            } else {
                // 无报告 → 获取设备并插入完整报告
                let device = await get(
                    'SELECT device_id FROM devices WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                    [req.user.user_id]
                );
                if (!device) {
                    const autoDeviceId = generateDeviceId();
                    const autoSerialNo = generateVirtualSerialNo();
                    await run(
                        `INSERT INTO devices (device_id, user_id, serial_no, name, is_virtual, firmware_version)
                         VALUES (?, ?, ?, '默认睡眠监测设备', 1, 'V1.0.0')`,
                        [autoDeviceId, req.user.user_id, autoSerialNo]
                    );
                    device = { device_id: autoDeviceId };
                }

                const mockData = generateMockSleepData(`${req.user.user_id}_${device.device_id}_${reportDate}`);
                mockData.noise_json = JSON.stringify(noiseData);
                mockData.sleep_stages_json = mockData.sleep_stages_json || JSON.stringify(generateSleepStages(seededRandom(`${req.user.user_id}_${reportDate}_stages`)));
                await run(
                    `INSERT INTO sleep_reports (
                        user_id, device_id, report_date, sleep_score,
                        total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes,
                        light_sleep_minutes, awake_minutes, awake_count, avg_heart_rate,
                        heart_rate_json, respiration_json, sleep_stages_json, noise_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        req.user.user_id, device.device_id, reportDate,
                        mockData.sleep_score, mockData.total_sleep_minutes,
                        mockData.deep_sleep_minutes, mockData.rem_sleep_minutes,
                        mockData.light_sleep_minutes, mockData.awake_minutes,
                        mockData.awake_count, mockData.avg_heart_rate,
                        mockData.heart_rate_json, mockData.respiration_json,
                        mockData.sleep_stages_json, mockData.noise_json,
                    ]
                );
            }

            saveDatabase();
        }

        return ok(res, {
            date: reportDate,
            total_points: noiseData.length,
            noise: noiseData,
            unit: 'dB',
            encoding: '夜间22:00-06:00为30-40dB, 白天06:00-22:00为45-65dB',
        });
    } catch (err) {
        console.error('[sleep/noise] error:', err);
        return fail(res, '获取噪音数据失败', 500, 500);
    }
});

// ============ 作息设置接口 ============
/**
 * GET /api/setting/plan
 * 获取用户作息设置（就寝时间、起床时间、日出模拟时长）
 */
app.get('/api/setting/plan', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;

        // 查询用户设置
        let setting = await get(
            'SELECT bedtime, wakeup_time, sunrise_duration FROM user_settings WHERE user_id = ?',
            [userId]
        );

        if (!setting) {
            await run('INSERT INTO user_settings (user_id) VALUES (?)', [userId]);
            setting = { bedtime: '23:00', wakeup_time: '07:00', sunrise_duration: 10 };
        }

        return ok(res, {
            bed_time: setting.bedtime || '23:00',
            wake_time: setting.wakeup_time || '07:00',
            sunrise_duration_minutes: setting.sunrise_duration || 10,
        });
    } catch (err) {
        console.error('[getSettingPlan] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

/**
 * PUT /api/setting/plan
 * 更新用户作息设置
 */
app.put('/api/setting/plan', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { bed_time, wake_time, sunrise_duration_minutes } = req.body || {};

        if (!bed_time || !wake_time || sunrise_duration_minutes === undefined) {
            return fail(res, '参数不完整', 400);
        }

        const duration = Number(sunrise_duration_minutes);
        if (duration < 5 || duration > 30) {
            return fail(res, '日出模拟时长需在5-30分钟之间', 400);
        }

        // 确保记录存在
        let setting = await get('SELECT id FROM user_settings WHERE user_id = ?', [userId]);
        if (!setting) {
            await run('INSERT INTO user_settings (user_id) VALUES (?)', [userId]);
        }

        await run(
            `UPDATE user_settings SET bedtime = ?, wakeup_time = ?, sunrise_duration = ?,
             updated_at = NOW() WHERE user_id = ?`,
            [bed_time, wake_time, duration, userId]
        );

        saveDatabase();

        return ok(res, { bed_time, wake_time, sunrise_duration_minutes: duration }, '保存成功');
    } catch (err) {
        console.error('[putSettingPlan] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

// ============ 医生授权接口 ============

/**
 * POST /api/doctor/grant
 * 授权医生：患者通过手机号或医生ID添加医生授权
 */
app.post('/api/doctor/grant', authMiddleware, async (req, res) => {
    try {
        const patientId = req.user.user_id;
        const { doctor_phone, doctor_id } = req.body || {};

        // 支持通过 doctor_id 或 doctor_phone 查找医生
        let doctor;
        if (Number.isInteger(doctor_id) && doctor_id > 0) {
            // 通过 ID 查找
            doctor = await get(
                "SELECT user_id, phone, nickname FROM users WHERE user_id = ? AND role = 1 AND status = 0",
                [Number(doctor_id)]
            );
        } else if (doctor_phone) {
            // 通过手机号查找
            doctor = await get(
                "SELECT user_id, phone, nickname FROM users WHERE phone = ? AND role = 1 AND status = 0",
                [doctor_phone]
            );
        } else {
            return fail(res, '请提供医生ID或手机号', 400);
        }

        if (!doctor) {
            return fail(res, '该医生不存在或未注册为医生', 400);
        }

        // 不能授权自己
        if (doctor.user_id === patientId) {
            return fail(res, '不能授权自己', 400);
        }

        // 检查是否已存在授权记录（包括已撤销的）
        const existing = await get(
            `SELECT id, status FROM doctor_authorizations
             WHERE doctor_id = ? AND patient_id = ?`,
            [doctor.user_id, patientId]
        );

        if (existing) {
            // 已有 pending 或 active 状态 → 拒绝
            if (existing.status === 1 || existing.status === 2) {
                const statusMap = { 1: 'pending', 2: 'active' };
                return fail(res, `该医生已在${statusMap[existing.status] || ''}状态，无需重复授权`, 400);
            }
            // 已撤销(status=3) → 重新激活
            await run(
                `UPDATE doctor_authorizations SET status = 1, updated_at = NOW()
                 WHERE id = ?`,
                [existing.id]
            );
        } else {
            // 新建授权记录
            await run(
                `INSERT INTO doctor_authorizations (doctor_id, patient_id, status)
                 VALUES (?, ?, 1)`,
                [doctor.user_id, patientId]
            );
        }

        saveDatabase();

        // 计算过期时间（30天后）
        const expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + 30);

        const authId = existing ? existing.id : (await get('SELECT LAST_INSERT_ID() AS id')).id;

        const authRecord = {
            id: authId,
            doctor_id: doctor.user_id,
            doctor_name: doctor.nickname,
            doctor_phone: doctor.phone,
            patient_id: patientId,
            status: 'pending',
            expire_date: expireDate.toISOString().slice(0, 10),
        };

        console.log(`[grantDoctor] 患者${patientId} 授权医生 ${doctor.phone}(${doctor.nickname})`);
        return ok(res, authRecord, '授权成功');
    } catch (err) {
        console.error('[grantDoctor] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

/**
 * DELETE /api/doctor/revoke
 * 撤销医生授权
 */
app.delete('/api/doctor/revoke', authMiddleware, async (req, res) => {
    try {
        const patientId = req.user.user_id;
        const { auth_id } = req.query || {};

        if (!auth_id) {
            return fail(res, '缺少授权记录ID', 400);
        }

        // 查找授权记录，确认属于当前患者
        const authRecord = await get(
            'SELECT id, status FROM doctor_authorizations WHERE id = ? AND patient_id = ?',
            [Number(auth_id), patientId]
        );

        if (!authRecord) {
            return fail(res, '授权记录不存在', 404);
        }

        if (authRecord.status === 3) {
            return fail(res, '该授权已被撤销', 400);
        }

        // 更新状态为 revoked(3)
        await run(
            "UPDATE doctor_authorizations SET status = 3, updated_at = NOW() WHERE id = ?",
            [Number(auth_id)]
        );

        saveDatabase();

        console.log(`[revokeDoctor] 患者${patientId} 撤销授权 ${auth_id}`);
        return ok(res, null, '撤销成功');
    } catch (err) {
        console.error('[revokeDoctor] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

/**
 * GET /api/doctor/granted
 * 获取已授权医生列表（JOIN users 表）
 */
app.get('/api/doctor/granted', authMiddleware, async (req, res) => {
    try {
        const patientId = req.user.user_id;

        // JOIN users 查询有效授权列表，过滤过期和撤销的记录
        const rows = await all(
            `SELECT a.id, a.doctor_id, a.patient_id, a.status, a.created_at as requested_at,
                    u.phone AS doctor_phone, u.nickname AS doctor_name
             FROM doctor_authorizations a
             INNER JOIN users u ON a.doctor_id = u.user_id
             WHERE a.patient_id = ?
               AND a.status IN (1, 2)
               AND a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             ORDER BY a.created_at DESC`,
            [patientId]
        );

        const list = rows.map(row => ({
            id: row.id,
            doctor_id: row.doctor_id,
            doctor_name: row.doctor_name || '未知医生',
            doctor_phone: row.doctor_phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
            status: row.status === 1 ? 'pending' : 'active',
            status_text: row.status === 1 ? '待确认' : '已确认',
            requested_at: row.requested_at,
            expire_date: (() => {
                const d = new Date(row.requested_at);
                d.setDate(d.getDate() + 30);
                return d.toISOString().slice(0, 10);
            })(),
        }));

        console.log(`[grantedDoctors] 患者${patientId} 有 ${list.length} 条有效授权`);
        return ok(res, { list });
    } catch (err) {
        console.error('[grantedDoctors] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

// ============ 医生端 API（第10大节） ============

/**
 * GET /api/users/doctors
 * 获取所有医生列表（供患者选择授权）
 */
app.get('/api/users/doctors', authMiddleware, async (req, res) => {
    try {
        const rows = await all(
            `SELECT user_id, phone, nickname FROM users WHERE role = 1 AND status = 0 ORDER BY user_id`
        );
        const list = rows.map(r => ({
            id: r.user_id,
            phone: r.phone,
            nickname: r.nickname || '未命名医生',
        }));
        return ok(res, { list });
    } catch (err) {
        console.error('[users/doctors] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

/**
 * PUT /api/doctor/confirm
 * 医生确认授权：将 pending 状态更新为 active
 */
app.put('/api/doctor/confirm', authMiddleware, async (req, res) => {
    try {
        // 验证医生角色
        if (req.user.role !== 1) {
            return fail(res, '仅医生可操作此接口', 403);
        }

        const doctorId = req.user.user_id;
        const { auth_id } = req.body || {};

        if (!auth_id) {
            return fail(res, '缺少授权记录ID', 400);
        }

        // 查找授权记录，确认属于当前医生
        const authRecord = await get(
            'SELECT id, status FROM doctor_authorizations WHERE id = ? AND doctor_id = ?',
            [Number(auth_id), doctorId]
        );

        if (!authRecord) {
            return fail(res, '授权记录不存在', 404);
        }

        if (authRecord.status === 2) {
            return fail(res, '该授权已确认，无需重复操作', 400);
        }

        if (authRecord.status === 3) {
            return fail(res, '该授权已被撤销', 400);
        }

        // 更新状态为 active(2)
        await run(
            `UPDATE doctor_authorizations
             SET status = 2,
                 updated_at = NOW()
             WHERE id = ?`,
            [Number(auth_id)]
        );

        saveDatabase();

        console.log(`[confirmDoctor] 医生${doctorId} 确认授权 ${auth_id}`);
        return ok(res, { id: Number(auth_id), status: 'active' }, '确认成功');
    } catch (err) {
        console.error('[confirmDoctor] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

/**
 * GET /api/doctor/patients
 * 医生查看患者列表（JOIN users 获取患者信息）
 */
app.get('/api/doctor/patients', authMiddleware, async (req, res) => {
    try {
        // 验证医生角色
        if (req.user.role !== 1) {
            return fail(res, '仅医生可操作此接口', 403);
        }

        const doctorId = req.user.user_id;

        // JOIN patients 获取患者信息
        const rows = await all(
            `SELECT a.id AS auth_id, a.patient_id, a.status, a.created_at as requested_at,
                    a.doctor_note,
                    u.nickname, u.phone,
                    (SELECT sr.sleep_score FROM sleep_reports sr
                     WHERE sr.user_id = a.patient_id
                     ORDER BY sr.report_date DESC LIMIT 1) AS latest_score
             FROM doctor_authorizations a
             INNER JOIN users u ON a.patient_id = u.user_id
             WHERE a.doctor_id = ?
               AND a.status IN (1, 2)
             ORDER BY a.created_at DESC`,
            [doctorId]
        );

        const list = rows.map(row => ({
            auth_id: row.auth_id,
            patient_id: row.patient_id,
            nickname: row.nickname || '未知用户',
            phone: row.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
            status: row.status === 1 ? 'pending' : 'active',
            status_text: row.status === 1 ? '待确认' : '已授权',
            requested_at: row.requested_at,
            latest_score: row.latest_score || null,
            doctor_note: row.doctor_note || '',
        }));

        console.log(`[doctorPatients] 医生${doctorId} 有 ${list.length} 个患者`);
        return ok(res, { list });
    } catch (err) {
        console.error('[doctorPatients] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

/**
 * GET /api/doctor/patient/data
 * 医生查看患者报告数据（仅 active 可查看）
 */
app.get('/api/doctor/patient/data', authMiddleware, async (req, res) => {
    try {
        // 验证医生角色
        if (req.user.role !== 1) {
            return fail(res, '仅医生可操作此接口', 403);
        }

        const doctorId = req.user.user_id;
        const { patient_id } = req.query || {};

        if (!patient_id) {
            return fail(res, '缺少患者ID', 400);
        }

        // 权限校验：必须是 active 授权
        const authRecord = await get(
            `SELECT a.id, a.status, u.nickname, u.phone
             FROM doctor_authorizations a
             INNER JOIN users u ON a.patient_id = u.user_id
             WHERE a.doctor_id = ? AND a.patient_id = ? AND a.status = 2`,
            [doctorId, Number(patient_id)]
        );

        if (!authRecord) {
            return fail(res, '无权查看该患者报告（需先确认授权）', 403);
        }

        // 获取最近7天睡眠报告
        const reports = await all(
            `SELECT report_date, sleep_score, total_sleep_minutes,
                    deep_sleep_minutes, rem_sleep_minutes, light_sleep_minutes,
                    awake_count
             FROM sleep_reports
             WHERE user_id = ?
             ORDER BY report_date DESC
             LIMIT 7`,
            [Number(patient_id)]
        ).reverse(); // 正序排列

        // 计算汇总指标
        const scores = reports.map(r => r.sleep_score).filter(Boolean);
        const avgScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null;

        const data = {
            patient_name: authRecord.nickname,
            reports: reports.map(r => ({
                date: r.report_date,
                score: r.sleep_score,
                duration: r.total_sleep_minutes,
                deep_minutes: r.deep_sleep_minutes,
                rem_minutes: r.rem_sleep_minutes,
                light_minutes: r.light_sleep_minutes,
                awake_count: r.awake_count,
            })),
            summary: {
                avg_score: avgScore,
                latest_score: scores.length > 0 ? scores[scores.length - 1] : null,
                record_count: reports.length,
            },
        };

        console.log(`[doctorPatientData] 医生${doctorId} 查看患者${patient_id}`);
        return ok(res, data);
    } catch (err) {
        console.error('[doctorPatientData] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

/**
 * PUT /api/doctor/note
 * 医生保存干预建议到授权记录的 doctor_note 字段
 */
app.put('/api/doctor/note', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 1) {
            return fail(res, '仅医生可操作此接口', 403);
        }

        const doctorId = req.user.user_id;
        const { auth_id, note } = req.body || {};

        if (!auth_id) {
            return fail(res, '缺少授权记录ID', 400);
        }
        if (typeof note !== 'string') {
            return fail(res, '建议内容必须为文本', 400);
        }

        // 验证授权记录属于当前医生且为 active 状态
        const authRecord = await get(
            `SELECT id FROM doctor_authorizations WHERE id = ? AND doctor_id = ? AND status = 2`,
            [Number(auth_id), doctorId]
        );

        if (!authRecord) {
            return fail(res, '授权记录不存在或无权操作', 404);
        }

        // 更新干预建议
        await run(
            `UPDATE doctor_authorizations SET doctor_note = ?, updated_at = NOW() WHERE id = ?`,
            [note.trim(), Number(auth_id)]
        );
        saveDatabase();

        console.log(`[doctorNote] 医生${doctorId} 更新授权${auth_id}的建议`);
        return ok(res, { auth_id: Number(auth_id), note: note.trim() }, '建议已保存');
    } catch (err) {
        console.error('[doctorNote] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

/**
 * GET /api/doctor/note
 * 获取医生对某患者的干预建议
 */
app.get('/api/doctor/note', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 1) {
            return fail(res, '仅医生可操作此接口', 403);
        }

        const doctorId = req.user.user_id;
        const { auth_id } = req.query || {};

        if (!auth_id) {
            return fail(res, '缺少授权记录ID', 400);
        }

        // 查询干预建议（仅 active 授权）
        const record = await get(
            `SELECT a.id AS auth_id, a.doctor_note, u.nickname, u.phone
             FROM doctor_authorizations a
             INNER JOIN users u ON a.patient_id = u.user_id
             WHERE a.id = ? AND a.doctor_id = ? AND a.status = 2`,
            [Number(auth_id), doctorId]
        );

        if (!record) {
            return fail(res, '授权记录不存在或无权查看', 404);
        }

        return ok(res, {
            auth_id: record.auth_id,
            patient_name: record.nickname,
            doctor_note: record.doctor_note || '',
        });
    } catch (err) {
        console.error('[doctorNoteGet] error:', err);
        return fail(res, '服务器内部错误', 500);
    }
});

// ============ 静态文件服务 ============
app.use(express.static(__dirname + '/public'));

// ============ 统一错误处理（必须放在所有路由之后）============

/** 404 未匹配路由处理 */
app.use((req, res) => {
    return fail(res, `接口不存在: ${req.method} ${req.path}`, 404, 404);
});

/**
 * 全局异常捕获中间件
 * 捕获所有路由中未处理的同步/异步错误，统一返回格式化响应
 * 统一日志格式：[时间] [级别] [方法 路径] 消息
 */
app.use((err, req, res, _next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const path = req.path;
    const errMsg = err.message || '服务器内部错误';

    // 统一格式日志输出
    console.error(`[${timestamp}] [ERROR] [${method} ${path}] ${errMsg}`);
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack || '');
    }

    // JWT 相关错误
    if (err.name === 'JsonWebTokenError') {
        return fail(res, 'token 无效', 401, 401);
    }
    if (err.name === 'TokenExpiredError') {
        return fail(res, 'token 已过期，请重新登录', 401, 401);
    }

    // 参数校验错误
    if (err.type === 'entity.parse.failed') {
        return fail(res, '请求体 JSON 格式错误', 400, 400);
    }
    if (err.type === 'params.invalid') {
        return fail(res, errMsg || '参数格式错误', 400, 400);
    }

    // 数据库相关错误
    if (errMsg.includes('SQLITE') || errMsg.includes('database')) {
        return fail(res, '数据库操作失败', 500, 500);
    }

    // 默认服务器内部错误
    const status = err.status || err.statusCode || 500;
    return fail(res, errMsg, status >= 400 ? 1 : 1, status);
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
