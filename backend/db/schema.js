/**
 * 数据库 Schema 定义
 * 定义睡眠评估干预系统所需的全部表结构
 * @author Developer
 * @created 2026-06-22
 */

const SCHEMA_SQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone VARCHAR(20) NOT NULL UNIQUE,
    nickname VARCHAR(50) NOT NULL DEFAULT '用户',
    avatar_url VARCHAR(255),
    gender INTEGER NOT NULL DEFAULT 0,
    birth_year INTEGER,
    password_hash VARCHAR(255) NOT NULL,
    role INTEGER NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 设备表
CREATE TABLE IF NOT EXISTS devices (
    device_id VARCHAR(32) PRIMARY KEY,
    user_id INTEGER,
    device_name VARCHAR(50) NOT NULL DEFAULT '我的设备',
    is_virtual INTEGER NOT NULL DEFAULT 0,
    firmware_version VARCHAR(20) NOT NULL DEFAULT 'V1.0.0',
    last_active_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 睡眠报告表
CREATE TABLE IF NOT EXISTS sleep_reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id VARCHAR(32) NOT NULL,
    report_date DATE NOT NULL,
    sleep_score INTEGER NOT NULL DEFAULT 0,
    total_minutes INTEGER NOT NULL DEFAULT 0,
    deep_minutes INTEGER NOT NULL DEFAULT 0,
    rem_minutes INTEGER NOT NULL DEFAULT 0,
    light_minutes INTEGER NOT NULL DEFAULT 0,
    wake_minutes INTEGER NOT NULL DEFAULT 0,
    avg_heart_rate REAL,
    events_json TEXT,
    heart_rate_curve TEXT,
    respiration_curve TEXT,
    stage_curve TEXT,
    noise_curve TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    bedtime TIME,
    wakeup_time TIME,
    sunset_duration INTEGER NOT NULL DEFAULT 10,
    sunrise_duration INTEGER NOT NULL DEFAULT 10,
    light_temp_min INTEGER NOT NULL DEFAULT 2200,
    light_temp_max INTEGER NOT NULL DEFAULT 4000,
    sound_enabled INTEGER NOT NULL DEFAULT 1,
    sound_type VARCHAR(20) NOT NULL DEFAULT 'white',
    noise_canceling INTEGER NOT NULL DEFAULT 0,
    notification_enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 睡眠日记表
CREATE TABLE IF NOT EXISTS sleep_diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    bed_time TIME NOT NULL,
    sleep_latency_min INTEGER NOT NULL DEFAULT 0,
    wakeup_times INTEGER NOT NULL DEFAULT 0,
    wakeup_time TIME NOT NULL,
    daytime_sleepiness INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 量表结果表
CREATE TABLE IF NOT EXISTS questionnaire_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(10) NOT NULL,
    answers_json TEXT NOT NULL,
    total_score INTEGER NOT NULL,
    level VARCHAR(20),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 医生授权表
CREATE TABLE IF NOT EXISTS doctor_authorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_is_virtual ON devices(is_virtual);
CREATE UNIQUE INDEX IF NOT EXISTS uk_sleep_reports_user_date ON sleep_reports(user_id, report_date);
CREATE INDEX IF NOT EXISTS idx_sleep_diary_user_date ON sleep_diary(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS uk_doctor_patient ON doctor_authorizations(doctor_id, patient_id);
`;

module.exports = SCHEMA_SQL;
