#!/bin/bash
# 睡眠评估干预系统 - 一键部署脚本
# 适用于 Ubuntu 22.04

set -e

echo "========================================"
echo "  睡眠评估干预系统 - 开始部署"
echo "========================================"

# ============ 1. 系统更新 ============
echo "[1/8] 更新系统..."
apt-get update -y
apt-get upgrade -y

# ============ 2. 安装 Node.js 18 ============
echo "[2/8] 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v
npm -v

# ============ 3. 安装 MySQL 8 ============
echo "[3/8] 安装 MySQL 8..."
apt-get install -y mysql-server
systemctl start mysql
systemctl enable mysql

# 创建数据库和用户
mysql -e "CREATE DATABASE IF NOT EXISTS sleep_care DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'sleepcare'@'localhost' IDENTIFIED BY 'SleepCare@2024';"
mysql -e "GRANT ALL PRIVILEGES ON sleep_care.* TO 'sleepcare'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"
echo "MySQL 数据库 sleep_care 已创建"

# ============ 4. 安装 Nginx ============
echo "[4/8] 安装 Nginx..."
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx

# ============ 5. 安装 PM2 ============
echo "[5/8] 安装 PM2..."
npm install -g pm2

# ============ 6. 创建应用目录并上传代码 ============
echo "[6/8] 部署应用代码..."
mkdir -p /var/www/sleep-care
cd /var/www/sleep-care

# 创建 .env 文件
cat > .env << 'EOF'
PORT=3000
JWT_SECRET=sleep_care_production_secret_2024
JWT_EXPIRES_IN=7d
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=sleepcare
MYSQL_PASSWORD=SleepCare@2024
MYSQL_DATABASE=sleep_care
EOF

# 创建后端目录结构
mkdir -p backend/db backend/test backend/public

# 复制后端代码（从本地上传后执行）
echo "等待代码上传..."

# ============ 7. 配置 Nginx ============
echo "[7/8] 配置 Nginx..."
cat > /etc/nginx/sites-available/sleep-care << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/sleep-care /etc/nginx/sites-enabled/sleep-care
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# ============ 8. 启动应用 ============
echo "[8/8] 启动应用..."
cd /var/www/sleep-care/backend
npm install
pm2 start app.js --name sleep-care
pm2 save
pm2 startup

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo "后端地址: http://$(curl -s ifconfig.me)"
echo "PM2 状态: pm2 status"
echo "查看日志: pm2 logs sleep-care"
echo "========================================"
