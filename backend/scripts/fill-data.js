/**
 * 数据库填充脚本 - 批量生成完整测试数据
 * 运行: node backend/scripts/fill-data.js
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function main() {
  const SQL = await initSqlJs({
    locateFile: f => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f)
  });
  const dbPath = path.resolve(__dirname, '..', '..', 'sleep_care.db');
  const db = new SQL.Database(fs.readFileSync(dbPath));

  // ====== 1. 查看当前状态 ======
  console.log('=== 当前数据库状态 ===');
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  tables[0].values.forEach(t => {
    const cnt = db.exec(`SELECT COUNT(*) as c FROM ${t[0]}`);
    console.log(`  ${t[0]}: ${cnt[0].values[0][0]} rows`);
  });

  // 获取现有用户和设备
  const users = db.exec('SELECT user_id FROM users')[0]?.values?.map(r => r[0]) || [];
  console.log(`\n用户数: ${users.length}`);

  // ====== 2. 补充用户和设备 ======
  if (users.length < 3) {
    console.log('\n补充用户和设备...');
    // 添加更多用户
    if (users.length <= 1) {
      db.run(`INSERT INTO users (phone, nickname, password_hash, role, status)
              VALUES ('13800138000', '张三', '$2a$10$xxx', 0, 0)`);
      users.push(db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]);
      db.run(`INSERT INTO users (phone, nickname, password_hash, role, status)
              VALUES ('13900139000', '李四', '$2a$10$xxx', 0, 0)`);
      users.push(db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]);
      db.run(`INSERT INTO users (phone, nickname, password_hash, role, status)
              VALUES ('13700137000', '王医生', '$2a$10$xxx', 1, 0)`);
      users.push(db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]);
    }

    // 为每个用户添加设备
    for (const uid of users) {
      const devCnt = db.exec(`SELECT COUNT(*) as c FROM devices WHERE user_id = ${uid}`)[0].values[0][0];
      if (devCnt < 2) {
        db.run(`INSERT INTO devices (device_id, user_id, serial_no, name, is_virtual, firmware_version)
                VALUES ('DEV_${uid}_01', ${uid}, 'SN${uid}01', '智能手环', 1, 'V2.5.1')`);
        db.run(`INSERT INTO devices (device_id, user_id, serial_no, name, is_virtual, firmware_version)
                VALUES ('DEV_${uid}_02', ${uid}, 'SN${uid}02', '睡眠监测垫', 1, 'V3.2.0')`);
        console.log(`  用户 ${uid}: 已添加 2 个设备`);
      }
    }
  }

  // ====== 3. 确定性伪随机 ======
  function seededRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    return function () {
      hash += 0x6D2B79F5;
      let t = hash;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateMockSleepData(seed) {
    const rng = seededRandom(seed);
    const totalMin = Math.floor(380 + rng() * 100);
    const deepRatio = 0.13 + rng() * 0.10;
    const remRatio = 0.18 + rng() * 0.07;
    const lightRatio = 0.42 + rng() * 0.13;
    const rawTotal = deepRatio + remRatio + lightRatio;
    const deepMin = Math.round(totalMin * (deepRatio / rawTotal));
    const remMin = Math.round(totalMin * (remRatio / rawTotal));
    const lightMin = totalMin - deepMin - remMin;
    const awakeMin = Math.floor(12 + rng() * 33);
    const awakeCount = Math.floor(2 + rng() * 7);
    const avgHR = Math.round((58 + rng() * 14) * 100) / 100;
    const qualityScore = Math.min(95, Math.max(50,
      Math.round(70 - awakeCount * 3 + (deepRatio * 80) + (remRatio * 30))
    ));

    const heartRateCurve = [];
    for (let i = 0; i < totalMin; i += 60) heartRateCurve.push(Math.round(avgHR + (rng() - 0.5) * 8));

    const stageCurve = [];
    const totalEpochs = Math.floor(totalMin * 2);
    let currentStage = 1;
    for (let i = 0; i < totalEpochs; i++) {
      if (i < 20) { stageCurve.push(0); continue; }
      const r = rng();
      if (currentStage === 1 && r < 0.08) currentStage = 2;
      else if (currentStage === 2 && r < 0.06) currentStage = 3;
      else if (currentStage === 3 && r < 0.05) currentStage = 1;
      else if (currentStage === 1 && r < 0.03) currentStage = 0;
      else if (currentStage === 0 && r < 0.85) currentStage = 1;
      stageCurve.push(currentStage);
    }

    const noiseCurve = [];
    for (let i = 0; i < 24; i++) noiseCurve.push(Math.round(28 + rng() * 22));

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

  // ====== 4. 填充历史数据 ======
  console.log('\n=== 开始填充历史数据 ===');
  const existingDates = new Set();
  const existing = db.exec('SELECT report_date FROM sleep_reports');
  existing[0]?.values?.forEach(r => existingDates.add(r[0]));
  console.log(`已有记录: ${existingDates.size} 条`);

  let insertedReports = 0;

  // 为每个用户填充过去 180 天的数据（跳过已存在的）
  for (const userId of users) {
    const userDevices = db.exec(
      `SELECT device_id FROM devices WHERE user_id = ${userId}`
    )[0]?.values?.map(r => r[0]) || [];
    const deviceId = userDevices[0] || `DEV_${userId}_01`;

    const today = new Date();
    for (let daysAgo = 179; daysAgo >= 0; daysAgo--) {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      const dateStr = d.toISOString().slice(0, 10);

      if (existingDates.has(dateStr)) continue;

      const seed = `${userId}_${deviceId}_${dateStr}`;
      const data = generateMockSleepData(seed);

      db.run(
        `INSERT INTO sleep_reports (
          user_id, device_id, report_date, sleep_score,
          total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes,
          light_sleep_minutes, awake_minutes, awake_count, avg_heart_rate,
          heart_rate_json, respiration_json, sleep_stages_json, noise_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, deviceId, dateStr, data.sleep_score,
          data.total_sleep_minutes, data.deep_sleep_minutes, data.rem_sleep_minutes,
          data.light_sleep_minutes, data.awake_minutes, data.awake_count,
          data.avg_heart_rate, data.heart_rate_json, data.respiration_json,
          data.sleep_stages_json, data.noise_json,
        ]
      );
      insertedReports++;
    }
  }
  console.log(`新插入睡眠报告: ${insertedReports} 条`);

  // ====== 5. 填充睡眠日记 ======
  console.log('\n填充睡眠日记...');
  const diaryNotes = [
    '昨晚睡得不错，今天精神状态良好',
    '有点失眠，凌晨才睡着',
    '做了很多梦，醒来感觉累',
    '按时入睡，深度睡眠充足',
    '工作压力大，睡眠质量下降',
    '睡前运动了一下，睡得很香',
    '喝了咖啡影响睡眠',
    '今天休息日，自然醒的感觉真好',
    '空调温度太低，中途醒了',
    '阅读后入睡，很放松',
  ];

  let insertedDiary = 0;
  for (const userId of users.slice(0, 2)) {
    const today = new Date();
    for (let daysAgo = 59; daysAgo >= 0; daysAgo -= Math.floor(Math.random() * 2) + 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      const dateStr = d.toISOString().slice(0, 10);

      const exists = db.exec(
        `SELECT COUNT(*) as c FROM sleep_diary WHERE user_id = ${userId} AND date = '${dateStr}'`
      )[0].values[0][0];
      if (exists > 0) continue;

      const rng = seededRandom(`diary_${userId}_${dateStr}`);
      const bedHour = 21 + Math.floor(rng() * 3); // 21:00~23:59
      const bedMin = Math.floor(rng() * 60);
      const bedTime = `${String(bedHour).padStart(2,'0')}:${String(bedMin).padStart(2,'0')}`;
      const latencyMin = Math.floor(5 + rng() * 40);
      const wakeupTimes = Math.floor(rng() * 4);
      const wakeHour = 6 + Math.floor(rng() * 2);
      const wakeMin = Math.floor(rng() * 60);
      const wakeupTime = `${String(wakeHour).padStart(2,'0')}:${String(wakeMin).padStart(2,'0')}`;
      const daytimeSleepiness = Math.floor(rng() * 4) + 1; // 1-4
      const noteIdx = Math.floor(rng() * diaryNotes.length);

      db.run(
        `INSERT INTO sleep_diary (user_id, date, bed_time, sleep_latency_min,
         wakeup_times, wakeup_time, daytime_sleepiness, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, dateStr, bedTime, latencyMin, wakeupTimes, wakeupTime, daytimeSleepiness, diaryNotes[noteIdx]]
      );
      insertedDiary++;
    }
  }
  console.log(`新插入睡眠日记: ${insertedDiary} 条`);

  // ====== 6. 填充问卷结果 ======
  console.log('填充问卷结果...');
  const qTypes = ['PSQI', 'ESS', 'ISI'];
  let insertedQuestionnaire = 0;

  for (const userId of users.slice(0, 2)) {
    for (let monthAgo = 5; monthAgo >= 0; monthAgo--) {
      const d = new Date();
      d.setMonth(d.getMonth() - monthAgo);
      const dateStr = d.toISOString().slice(0, 10).slice(0, 7) + '-15';

      for (const qType of qTypes) {
        const exists = db.exec(
          `SELECT COUNT(*) as c FROM questionnaire_results WHERE user_id = ${userId}
           AND type = '${qType}' AND created_at LIKE '${dateStr.slice(0, 7)}%'`
        )[0].values[0][0];
        if (exists > 0) continue;

        const rng = seededRandom(`q_${userId}_${qType}_${dateStr}`);
        let totalScore;
        let level;
        if (qType === 'PSQI') { totalScore = Math.floor(4 + rng() * 14); level = totalScore > 8 ? 'poor' : 'normal'; }
        else if (qType === 'ESS') { totalScore = Math.floor(2 + rng() * 18); level = totalScore > 10 ? 'high' : 'low'; }
        else { totalScore = Math.floor(4 + rng() * 17); level = totalScore > 14 ? 'severe' : totalScore > 8 ? 'moderate' : 'mild'; }

        const answers = {};
        for (let i = 1; i <= 10; i++) answers[`q${i}`] = Math.floor(rng() * 5);

        db.run(
          `INSERT INTO questionnaire_results (user_id, type, answers_json, total_score, level, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, qType, JSON.stringify(answers), totalScore, level, dateStr]
        );
        insertedQuestionnaire++;
      }
    }
  }
  console.log(`新插入问卷结果: ${insertedQuestionnaire} 条`);

  // ====== 7. 填充医生授权记录 ======
  console.log('填充医生授权...');
  const existingAuth = db.exec('SELECT COUNT(*) as c FROM doctor_authorizations')[0].values[0][0];
  if (existingAuth < 1) {
    const doctorId = users[users.length - 1];
    for (const patientId of users.slice(0, 2)) {
      db.run(
        `INSERT INTO doctor_authorizations (doctor_id, patient_id, status, created_at)
        VALUES (?, ?, 1, datetime('now'))`,
        [doctorId, patientId]
      );
    }
    console.log(`  添加了 ${(users.slice(0, 2)).length} 条授权记录`);
  }

  // ====== 8. 保存并输出统计 ======
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log('\n' + '='.repeat(40));
  console.log('最终数据库统计:');
  console.log('='.repeat(40));
  tables[0].values.forEach(t => {
    const cnt = db.exec(`SELECT COUNT(*) as c FROM ${t[0]}`);
    console.log(`  ${String(t[0]).padEnd(25)} ${String(cnt[0].values[0][0]).padStart(5)} 行`);
  });

  const finalDateRange = db.exec(
    "SELECT MIN(report_date) as mn, MAX(report_date) as mx, COUNT(*) as cnt FROM sleep_reports"
  )[0].values[0];
  console.log(`\n  睡眠报告日期范围: ${finalDateRange[0]} ~ ${finalDateRange[1]}`);
  console.log(`  睡眠报告总数:     ${finalDateRange[2]}`);

  const avgScore = db.exec(
    'SELECT ROUND(AVG(sleep_score), 1) as avg FROM sleep_reports'
  )[0].values[0][0];
  console.log(`  平均睡眠评分:     ${avgScore}`);

  db.close();
  console.log('\n✓ 数据填充完成！');
}

main().catch(err => { console.error(err); process.exit(1); });
