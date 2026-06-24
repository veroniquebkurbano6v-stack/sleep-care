-- ============================================================
-- 睡眠评估干预系统 - MySQL DDL 迁移脚本
-- 从 SQLite (sql.js) 迁移至 MySQL 8.0+
-- 执行方式: mysql -u root -p sleep_care < docs/migration.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `sleep_care`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `sleep_care`;

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
    `user_id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `phone`           VARCHAR(20)    NOT NULL UNIQUE COMMENT '手机号',
    `nickname`        VARCHAR(50)    NOT NULL DEFAULT '用户' COMMENT '昵称',
    `avatar_url`      VARCHAR(255)   DEFAULT NULL COMMENT '头像URL',
    `gender`          TINYINT        NOT NULL DEFAULT 0 COMMENT '性别:0未知 1男 2女',
    `birth_year`      SMALLINT       DEFAULT NULL COMMENT '出生年份',
    `password_hash`   VARCHAR(255)   NOT NULL COMMENT '密码哈希(bcrypt)',
    `role`            TINYINT        NOT NULL DEFAULT 0 COMMENT '角色:0患者 1医生',
    `status`          TINYINT        NOT NULL DEFAULT 0 COMMENT '状态:0正常 1禁用',
    `created_at`      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_users_phone` (`phone`),
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================================
-- 2. 设备表
-- ============================================================
CREATE TABLE IF NOT EXISTS `devices` (
    `device_id`           VARCHAR(32)    PRIMARY KEY COMMENT '设备唯一ID',
    `user_id`             BIGINT UNSIGNED DEFAULT NULL,
    `serial_no`           VARCHAR(32)    DEFAULT NULL COMMENT '序列号',
    `name`                VARCHAR(50)    NOT NULL DEFAULT '我的设备' COMMENT '设备名称',
    `is_virtual`          TINYINT        NOT NULL DEFAULT 0 COMMENT '是否虚拟设备',
    `firmware_version`    VARCHAR(20)    NOT NULL DEFAULT 'V1.0.0' COMMENT '固件版本',
    `last_active_time`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_devices_user_id` (`user_id`),
    INDEX `idx_devices_is_virtual` (`is_virtual`),
    CONSTRAINT `fk_devices_user`
        FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='设备表';

-- ============================================================
-- 3. 睡眠报告表
-- ============================================================
CREATE TABLE IF NOT EXISTS `sleep_reports` (
    `report_id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`             BIGINT UNSIGNED NOT NULL,
    `device_id`           VARCHAR(32)    NOT NULL,
    `report_date`         DATE           NOT NULL COMMENT '报告日期',
    `sleep_score`         INT            NOT NULL DEFAULT 0 COMMENT '睡眠评分(0-100)',
    `total_sleep_minutes` INT            NOT NULL DEFAULT 0 COMMENT '总睡眠时长(分钟)',
    `deep_sleep_minutes`  INT            NOT NULL DEFAULT 0 COMMENT '深睡时长(分钟)',
    `rem_sleep_minutes`   INT            NOT NULL DEFAULT 0 COMMENT 'REM时长(分钟)',
    `light_sleep_minutes` INT            NOT NULL DEFAULT 0 COMMENT '浅睡时长(分钟)',
    `awake_minutes`       INT            NOT NULL DEFAULT 0 COMMENT '清醒时长(分钟)',
    `awake_count`         INT            NOT NULL DEFAULT 0 COMMENT '觉醒次数',
    `avg_heart_rate`      DECIMAL(5,1)   DEFAULT NULL COMMENT '平均心率',
    `heart_rate_json`     TEXT           DEFAULT NULL COMMENT '心率曲线JSON',
    `respiration_json`    TEXT           DEFAULT NULL COMMENT '呼吸曲线JSON',
    `sleep_stages_json`   TEXT           DEFAULT NULL COMMENT '睡眠分期JSON',
    `noise_json`          TEXT           DEFAULT NULL COMMENT '噪声数据JSON',
    `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_sleep_reports_user_date` (`user_id`, `report_date`),
    INDEX `idx_sleep_reports_user_id` (`user_id`),
    INDEX `idx_sleep_reports_date` (`report_date`),
    INDEX `idx_sleep_reports_device_id` (`device_id`),
    CONSTRAINT `fk_report_user`
        FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_report_device`
        FOREIGN KEY (`device_id`) REFERENCES `devices`(`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='睡眠报告表';

-- ============================================================
-- 4. 用户设置表
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_settings` (
    `id`                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`             BIGINT UNSIGNED NOT NULL UNIQUE,
    `bedtime`             TIME           DEFAULT NULL COMMENT '目标入睡时间',
    `wakeup_time`         TIME           DEFAULT NULL COMMENT '目标起床时间',
    `sunset_duration`     INT            NOT NULL DEFAULT 10 COMMENT '日落渐暗(分钟)',
    `sunrise_duration`    INT            NOT NULL DEFAULT 10 COMMENT '日出渐亮(分钟)',
    `light_temp_min`      INT            NOT NULL DEFAULT 2200 COMMENT '最低色温(K)',
    `light_temp_max`      INT            NOT NULL DEFAULT 4000 COMMENT '最高色温(K)',
    `sound_enabled`       TINYINT        NOT NULL DEFAULT 1 COMMENT '声音开关',
    `sound_type`          VARCHAR(20)    NOT NULL DEFAULT 'white' COMMENT '声音类型',
    `noise_canceling`     TINYINT        NOT NULL DEFAULT 0 COMMENT '降噪开关',
    `notification_enabled`TINYINT        NOT NULL DEFAULT 1 COMMENT '通知开关',
    `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_settings_user`
        FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户设置表';

-- ============================================================
-- 5. 睡眠日记表
-- ============================================================
CREATE TABLE IF NOT EXISTS `sleep_diary` (
    `id`                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`             BIGINT UNSIGNED NOT NULL,
    `date`                DATE           NOT NULL COMMENT '日记日期',
    `bed_time`            TIME           NOT NULL COMMENT '上床时间',
    `sleep_latency_min`   INT            NOT NULL DEFAULT 0 COMMENT '入睡潜伏期(分)',
    `wakeup_times`        INT            NOT NULL DEFAULT 0 COMMENT '夜间觉醒次数',
    `wakeup_time`         TIME           NOT NULL COMMENT '起床时间',
    `daytime_sleepiness`  TINYINT        NOT NULL DEFAULT 0 COMMENT '白天嗜睡评分',
    `notes`               TEXT           DEFAULT NULL COMMENT '备注',
    `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sleep_diary_user_date` (`user_id`, `date`),
    CONSTRAINT `fk_diary_user`
        FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='睡眠日记表';

-- ============================================================
-- 6. 量表结果表
-- ============================================================
CREATE TABLE IF NOT EXISTS `questionnaire_results` (
    `id`                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`             BIGINT UNSIGNED NOT NULL,
    `type`                VARCHAR(10)    NOT NULL COMMENT '量表类型(psqi/epworth等)',
    `answers_json`        TEXT           NOT NULL COMMENT '答案JSON',
    `total_score`         INT            NOT NULL DEFAULT 0 COMMENT '总分',
    `level`               VARCHAR(20)    DEFAULT NULL COMMENT '等级',
    `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_qr_user`
        FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='量表结果表';

-- ============================================================
-- 7. 医生授权表
-- ============================================================
CREATE TABLE IF NOT EXISTS `doctor_authorizations` (
    `id`                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `doctor_id`           BIGINT UNSIGNED NOT NULL COMMENT '医生用户ID',
    `patient_id`          BIGINT UNSIGNED NOT NULL COMMENT '患者用户ID',
    `status`              TINYINT        NOT NULL DEFAULT 1 COMMENT '状态:1待确认 2已激活 3已撤销',
    `doctor_note`         TEXT           DEFAULT NULL COMMENT '医生干预建议',
    `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_doctor_auth_doctor` (`doctor_id`, `status`),
    INDEX `idx_doctor_auth_patient` (`patient_id`, `status`),
    UNIQUE KEY `uk_doctor_patient` (`doctor_id`, `patient_id`),
    CONSTRAINT `fk_auth_doctor`
        FOREIGN KEY (`doctor_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_auth_patient`
        FOREIGN KEY (`patient_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='医生授权表';
