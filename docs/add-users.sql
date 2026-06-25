INSERT INTO users (phone, nickname, gender, birth_year, password_hash, role, status) VALUES
('15000001111', '赵五', 0, 1990, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 0, 0),
('15000002222', '孙六', 1, 1985, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 0, 0),
('15000003333', '周七', 0, 1995, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 0, 0),
('15000004444', '吴八', 1, 1988, '$2a$10$M0QXjA0pPTJjkNUAnNXRW.rXo0mDCiqpYY4ftmrwXDhHf.W5ixF2G', 0, 0);
SELECT user_id, phone, nickname, role FROM users;
