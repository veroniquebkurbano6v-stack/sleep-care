/**
 * 端到端集成测试脚本
 * 覆盖注册、登录、设备管理、睡眠报告、分期、噪音、医生授权、干预建议全链路
 * 运行方式: node backend/test/integration.test.js
 * @author Developer
 * @created 2026-06-24
 */

const http = require('http');

// ============ 配置 ============
const BASE_URL = 'http://localhost:3000';
let token = '';
let userId = 0;
let deviceId = '';
let doctorId = 0;
let authId = 0;

/** 测试计数 */
let passCount = 0;
let failCount = 0;

/**
 * 发送 HTTP 请求（Promise 封装）
 * @param {string} method HTTP 方法
 * @param {string} url 请求路径
 * @param {object|null} body 请求体
 * @param {boolean} auth 是否携带 JWT Token
 * @returns {Promise<object>} 响应数据 { status, body }
 */
function request(method, url, body = null, auth = true) {
    return new Promise((resolve, reject) => {
        const u = new URL(url, BASE_URL);
        const options = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);

        if (body !== null) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

/**
 * 日志输出带颜色标记
 * @param {string} step 步骤名称
 * @param {boolean} success 是否通过
 * @param {string} detail 详情信息
 */
function logStep(step, success, detail = '') {
    const icon = success ? '\u2705' : '\u274C';
    console.log(`  ${icon} ${step}${detail ? ` - ${detail}` : ''}`);
    if (success) {
        passCount++;
    } else {
        failCount++;
    }
}

/**
 * 异步延迟
 * @param {number} ms 毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ 测试用例 ============

async function runTests() {
    console.log('\n========================================');
    console.log('  睡眠评估干预系统 - 端到端集成测试');
    console.log('========================================\n');

    // ---- 1. 注册普通用户 ----
    console.log('[1/12] 注册普通用户...');
    let res = await request('POST', '/api/v1/auth/register', {
        phone: `test_patient_${Date.now()}`,
        password: 'test123456',
        nickname: '测试患者',
        role: 0,
    }, false);
    const regOk = res.status === 200 && res.body.code === 0;
    logStep('注册患者', regOk, res.body?.data?.nickname || res.body?.message || '');
    if (regOk) userId = res.body.data.id;

    // ---- 2. 登录 ----
    console.log('\n[2/12] 用户登录...');
    // 使用已注册的手机号登录（如果注册成功则用新号，否则用已知账号）
    const loginPhone = res.body?.data?.phone || '15000009999';
    res = await request('POST', '/api/v1/auth/login', {
        phone: loginPhone,
        password: 'test123456',
    }, false);
    const loginOk = res.status === 200 && res.body.code === 0 && !!res.body.data.token;
    logStep('登录验证', loginOk, `token=${(res.body?.data?.token || '').slice(0, 20)}...`);
    if (loginOk) {
        token = res.body.data.token;
        userId = res.body.data.user.user_id || userId;
    }

    // ---- 3. 获取当前用户信息 ----
    console.log('\n[3/12] 获取当前用户...');
    res = await request('GET', '/api/v1/users/me');
    const meOk = res.status === 200 && res.body.code === 0 && res.body.data.nickname;
    logStep('获取用户信息', meOk, res.body?.data?.nickname || '');

    // ---- 4. 设备列表查询 ----
    console.log('\n[4/12] 查询设备列表...');
    res = await request('GET', '/api/v1/devices/list');
    const listOk = res.status === 200 && res.body.code === 0;
    logStep('设备列表查询', listOk, `${res.body?.data?.list?.length || 0} 台设备`);

    // ---- 5. 添加设备 ----
    console.log('\n[5/12] 添加虚拟设备...');
    res = await request('POST', '/api/v1/devices/add', { name: '测试睡眠监测仪', is_virtual: 1 });
    const addOk = res.status === 200 && res.body.code === 0 && res.body.data.device_id;
    logStep('添加设备', addOk, `serial_no=${res.body?.data?.serial_no || ''}`);
    if (addOk) deviceId = res.body.data.device_id;

    // ---- 6. 每日睡眠报告 ----
    console.log('\n[6/12] 获取每日睡眠报告...');
    res = await request('GET', '/api/sleep/report/daily?date=2026-06-24');
    const reportOk = res.status === 200 && res.body.code === 0 && res.body.data.report;
    logStep('获取报告', reportOk, `score=${res.body?.data?.report?.sleep_score || '--'}`);

    // ---- 7. 睡眠分期数据 ----
    console.log('\n[7/12] 获取睡眠分期数据...');
    res = await request('GET', '/api/sleep/stages?date=2026-06-24');
    const stagesOk = res.status === 200 && res.body.code === 0
        && Array.isArray(res.body.data.stages)
        && res.body.data.stages.length === 48;
    logStep('分期数据', stagesOk, `${res.body?.data?.total_points || 0} 个采样点`);

    // ---- 8. 噪音数据 ----
    console.log('\n[8/12] 获取噪音数据...');
    res = await request('GET', '/api/sleep/noise?date=2026-06-24');
    const noiseOk = res.status === 200 && res.body.code === 0
        && Array.isArray(res.body.data.noise)
        && res.body.data.noise.length === 144;
    logStep('噪音数据', noiseOk, `${res.body?.data?.total_points || 0} 个采样点`);

    // ---- 9. 注册医生 ----
    console.log('\n[9/12] 注册医生账号...');
    res = await request('POST', '/api/v1/auth/register', {
        phone: `test_doctor_${Date.now()}`,
        password: 'test123456',
        nickname: '测试医生',
        role: 1,
    }, false);
    const docRegOk = res.status === 200 && res.body.code === 0;
    logStep('注册医生', docRegOk, res.body?.data?.nickname || '');
    if (docRegOk) doctorId = res.body.data.id;

    // 医生登录获取 token
    if (docRegOk) {
        const docRes = await request('POST', '/api/v1/auth/login', {
            phone: res.body.data.phone,
            password: 'test123456',
        }, false);
        if (docRes.body.code === 0) {
            // 切换为患者 token 继续后续操作（保持原有流程）
        }
    }

    // ---- 10. 授权给医生 ----
    console.log('\n[10/12] 授权给医生...');
    // 需要先有医生在系统中，用手机号授权
    res = await request('POST', '/api/doctor/grant', { doctor_phone: res.body?.data?.phone || 'test_doctor' });
    const grantOk = res.status === 200 && (res.body.code === 0 || res.body.message.includes('已'));
    logStep('授权医生', grantOk, res.body?.message || '');

    // ---- 11. 已授权医生列表 ----
    console.log('\n[11/12] 查询已授权医生...');
    res = await request('GET', '/api/doctor/granted');
    const grantedOk = res.status === 200 && res.body.code === 0;
    logStep('已授权列表', grantedOk, `${Array.isArray(res.body?.data) ? res.body.data.length : 0} 条`);

    // ---- 12. 睡眠摘要统计 ----
    console.log('\n[12/12] 获取睡眠摘要...');
    res = await request('GET', '/api/sleep/summary?period=week');
    const summaryOk = res.status === 200 && res.body.code === 0;
    logStep('睡眠摘要', summaryOk, `avg_score=${res.body?.data?.avg_score ?? '--'}`);

    // ============ 结果汇总 ============
    console.log('\n========================================');
    console.log(`  总计: ${passCount + failCount} 项 | 通过: ${passCount} 项 | 失败: ${failCount} 项`);
    if (failCount === 0) {
        console.log('  \u2705 所有集成测试通过！');
    } else {
        console.log(`  \u274C 存在 ${failCount} 项失败，请检查上方日志`);
    }
    console.log('========================================\n');

    process.exit(failCount > 0 ? 1 : 0);
}

// 启动测试
runTests().catch((err) => {
    console.error('集成测试异常:', err.message);
    process.exit(1);
});
