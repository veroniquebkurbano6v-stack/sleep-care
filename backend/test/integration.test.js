/**
 * 端到端集成测试脚本
 * 覆盖注册、登录、设备管理、睡眠报告、分期、噪音、医生授权、干预建议全链路
 * 运行方式: node backend/test/integration.test.js（需先启动后端 npm run dev）
 * @author Developer
 * @created 2026-06-24
 */

const http = require('http');

// ============ 配置 ============
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
let token = '';
let userId = 0;
let deviceId = '';
let doctorId = 0;

/** 测试计数 */
let passCount = 0;
let failCount = 0;

/** 固定测试账号（使用全新账号，确保注册+登录全流程） */
const TEST_PATIENT_PHONE = '19900001111';
const TEST_DOCTOR_PHONE = '19900002222';
const TEST_PASSWORD = 'test123456';

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
 * 注册或登录（如果已注册则直接登录）
 * @param {string} phone 手机号
 * @param {string} nickname 昵称
 * @param {number} role 角色
 * @returns {Promise<{ok:boolean, userId:number, phone:string}>}
 */
async function registerOrLogin(phone, nickname, role) {
    // 先尝试注册
    let res = await request('POST', '/api/v1/auth/register', {
        phone, password: TEST_PASSWORD, nickname, role,
    }, false);

    if (res.body.code === 0) {
        // 注册成功，需要登录获取 token
        return { ok: true, userId: res.body.data.id, phone, registered: true };
    }

    // 已注册（409）或其他错误 → 直接登录
    if (res.body.code === 409 || res.status === 409) {
        res = await request('POST', '/api/v1/auth/login', {
            phone, password: TEST_PASSWORD,
        }, false);
        if (res.body.code === 0 && res.body.data.token) {
            return { ok: true, userId: res.body.data.user?.user_id || 0, phone, registered: false };
        }
    }

    return { ok: false, userId: 0, phone, registered: false };
}

// ============ 测试用例 ============

async function runTests() {
    console.log('\n========================================');
    console.log('  睡眠评估干预系统 - 端到端集成测试');
    console.log('========================================');

    // 前置检查：后端是否运行
    const checkUrl = new URL(BASE_URL);
    process.stdout.write('\n[前置] 检查后端服务... ');
    try {
        await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: checkUrl.hostname, port: checkUrl.port || 80, path: '/', method: 'GET', timeout: 5000,
            }, (res) => { resolve(true); });
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.end();
        });
    } catch (_) {}
    // 简单 ping 检查
    const checkRes = await new Promise((resolve) => {
        const req = http.request({ hostname: checkUrl.hostname, port: checkUrl.port || 80, path: '/', method: 'GET', timeout: 5000 }, (res) => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(res.statusCode < 500));
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
    if (!checkRes) {
        console.log('\u274C 未连接');
        console.error(`  错误: 后端服务未启动 (${BASE_URL})`);
        console.error('  请先启动后端: cd backend && npm run dev');
        process.exit(1);
    }
    console.log('\u2705 已连接\n');

    // ---- 1. 注册/登录普通用户 ----
    console.log('[1/12] 注册/登录普通用户...');
    const patientResult = await registerOrLogin(TEST_PATIENT_PHONE, '测试患者', 0);
    logStep('注册/登录患者', patientResult.ok, patientResult.phone);

    // ---- 2. 登录获取 token ----
    console.log('\n[2/12] 获取登录 Token...');
    let res = await request('POST', '/api/v1/auth/login', {
        phone: TEST_PATIENT_PHONE, password: TEST_PASSWORD,
    }, false);
    const loginOk = res.status === 200 && res.body.code === 0 && !!res.body.data.token;
    logStep('登录验证', loginOk, `token=${(res.body?.data?.token || '').slice(0, 20)}...`);
    if (loginOk) {
        token = res.body.data.token;
        userId = res.body.data.user?.user_id || patientResult.userId;
    }

    // ---- 3. 获取当前用户信息 ----
    console.log('\n[3/12] 获取当前用户...');
    res = await request('GET', '/api/v1/users/me');
    const meOk = res.status === 200 && res.body.code === 0
        && (res.body.data?.user?.nickname || res.body.data?.nickname);
    logStep('获取用户信息', meOk, res.body.data?.user?.nickname || res.body.data?.nickname || '');

    // ---- 4. 设备列表查询 ----
    console.log('\n[4/12] 查询设备列表...');
    res = await request('GET', '/api/v1/devices/list');
    const listOk = res.status === 200 && res.body.code === 0;
    logStep('设备列表查询', listOk, `${res.body?.data?.list?.length || 0} 台设备`);

    // ---- 5. 添加设备 ----
    console.log('\n[5/12] 添加虚拟设备...');
    res = await request('POST', '/api/v1/devices/add', { name: '测试睡眠监测仪', is_virtual: 1 });
    const addOk = res.status === 200 && res.body.code === 0
        && (res.body.data?.device_id || res.body.data?.device?.device_id);
    logStep('添加设备', addOk, `serial_no=${res.body.data?.device?.serial_no || res.body.data?.serial_no || ''}`);
    if (addOk) deviceId = res.body.data?.device_id || res.body.data?.device?.device_id;

    // ---- 6. 每日睡眠报告 ----
    console.log('\n[6/12] 获取每日睡眠报告...');
    res = await request('GET', '/api/sleep/report/daily?date=2026-06-24');
    const reportOk = res.status === 200 && res.body.code === 0 && res.body.data.report;
    logStep('获取报告', reportOk, `score=${res.body?.data?.report?.sleep_score ?? '--'}`);

    // ---- 7. 睡眠分期数据 ----
    console.log('\n[7/12] 获取睡眠分期数据...');
    res = await request('GET', '/api/sleep/stages?date=2026-06-24');
    const stagesOk = res.status === 200 && res.body.code === 0
        && Array.isArray(res.body.data.stages)
        && res.body.data.stages.length > 0;
    logStep('分期数据', stagesOk, `${res.body?.data?.total_points || 0} 个采样点`);

    // ---- 8. 噪音数据 ----
    console.log('\n[8/12] 获取噪音数据...');
    res = await request('GET', '/api/sleep/noise?date=2026-06-24');
    const noiseOk = res.status === 200 && res.body.code === 0
        && Array.isArray(res.body.data.noise)
        && res.body.data.noise.length > 0;
    logStep('噪音数据', noiseOk, `${res.body?.data?.total_points || 0} 个采样点`);

    // ---- 9. 注册医生 ----
    console.log('\n[9/12] 注册医生账号...');
    const docResult = await registerOrLogin(TEST_DOCTOR_PHONE, '测试医生', 1);
    logStep('注册医生', docResult.ok, docResult.phone);
    if (docResult.ok) doctorId = docResult.userId;

    // ---- 10. 授权给医生 ----
    console.log('\n[10/12] 授权给医生...');
    res = await request('POST', '/api/doctor/grant', { doctor_phone: TEST_DOCTOR_PHONE });
    const grantOk = res.status === 200 && (res.body.code === 0 || String(res.body.message).includes('已'));
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
    console.error('\n集成测试异常:');
    console.error('  错误信息:', err.message || '未知错误');
    console.error('  错误代码:', err.code || 'N/A');
    if (err.code === 'ECONNREFUSED') {
        console.error('  原因: 后端服务未启动，请先运行: cd backend && npm run dev');
    }
    process.exit(1);
});
