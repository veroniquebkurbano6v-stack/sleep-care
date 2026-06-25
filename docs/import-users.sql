DELETE FROM users;
INSERT INTO users (phone, nickname, gender, birth_year, password_hash, role, status) VALUES
('19900009999', '设备测试用户', 0, NULL, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 0, 0),
('13800138000', '张三', 0, NULL, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 0, 0),
('13900139000', '李四', 0, NULL, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 0, 0),
('13700137000', '王医生', 0, NULL, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 1, 0),
('13900000100', '测试医生', 0, NULL, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 1, 0),
('13800008888', '测试患者', 0, NULL, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 0, 0);
SELECT user_id, phone, nickname, role FROM users;