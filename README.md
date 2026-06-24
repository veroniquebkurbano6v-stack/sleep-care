# 睡眠评估干预系统 (Sleep Care)

基于微信小程序 + Node.js Express 的睡眠健康评估与干预平台，支持睡眠数据采集、分期分析、噪音监测、医生远程干预等核心功能。

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端 | 微信小程序原生框架（Taro + React + TypeScript） |
| 后端 | Node.js 18+ / Express.js |
| 数据库 | SQLite (sql.js) / MySQL 双模式切换 |
| 认证 | JWT (JSON Web Token) |
| 图表 | 原生 Canvas API（柱状图/折线图） |

## 项目结构

```
sleep-care/
├── backend/                  # 后端服务
│   ├── app.js               # Express 入口 & API 路由
│   ├── db/
│   │   ├── connection.js     # 数据库连接管理（SQLite/MySQL 双模式）
│   │   ├── schema.js         # DDL 建表语句（含索引）
│   │   └── init.js           # 初始化脚本
│   └── test/
│       └── integration.test.js  # 端到端集成测试
├── miniprogram/              # 微信小程序
│   └── src/
│       ├── pages/            # 页面
│       │   ├── login/        # 登录页
│       │   ├── home/         # 首页（睡眠报告卡片）
│       │   ├── devices/      # 设备管理
│       │   ├── report/       # 睡眠分析报告（分期图+噪音图）
│       │   └── doctors/      # 医生授权
│       ├── components/       # 公共组件
│       │   ├── ec-canvas/    # 分期柱状图组件
│       │   └── noise-line-chart/  # 噪音折线图组件
│       ├── services/api.ts   # API 请求封装
│       └── app.config.ts     # 应用配置（tabBar 导航）
├── docs/                     # 文档
│   ├── api.yaml              # OpenAPI 3.0 接口文档（19 个接口）
│   ├── migration.sql         # MySQL 迁移 DDL
│   ├── migrate-data.js       # SQLite→MySQL 数据迁移脚本
│   └── 硬件对接方案.md        # 真实硬件接入方案
├── start.bat                 # 一键启动脚本
└── README.md                 # 本文件
```

## 快速开始

### 环境要求

- Node.js >= 18.0
- npm 或 pnpm

### 安装依赖

```bash
# 后端
cd backend && npm install

# 小程序
cd miniprogram && pnpm install
```

### 启动服务

**方式一：一键启动（Windows）**

```bash
双击 start.bat
```

**方式二：手动启动**

```bash
# 终端1：启动后端
cd backend && npm run dev

# 终端2：启动小程序预览
node "c:\Users\<用户名>\.trae-cn\builtin_skills\TRAE-generate-mini-app\scripts\preview-server.js" miniprogram
```

### 环境变量配置

```bash
# .env 文件（可选）
PORT=3000                    # 服务端口
JWT_SECRET=your_secret_key   # JWT 密钥
DATABASE_TYPE=sqlite         # sqlite(默认) | mysql
MYSQL_HOST=localhost         # MySQL 模式时必填
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=sleep_care
```

## 核心功能

### 用户体系
- 手机号注册/登录（支持患者/医生角色）
- JWT Token 身份认证

### 设备管理
- 设备绑定 CRUD（支持虚拟设备自动创建）
- 设备列表按 `created_at` 降序排列

### 睡眠数据分析
- **每日报告**：综合评分、总时长、深睡比例、觉醒次数
- **分期数据**：48 个采样点（每 10 分钟），0=清醒/1=浅睡/2=深睡/3=REM
- **噪音监测**：144 个采样点（每 10 分钟），夜间 30-40dB / 白天 45-65dB
- **摘要统计**：支持日/周/月维度汇总

### 医生干预
- 患者 → 医生授权流程（pending → active）
- 医生查看患者报告、撰写干预建议

## API 接口

完整接口文档见 [docs/api.yaml](docs/api.yaml)，共 19 个 RESTful 接口：

| 分类 | 接口 | 说明 |
|------|------|------|
| 认证 | `POST /api/v1/auth/register` | 注册 |
| | `POST /api/v1/auth/login` | 登录 |
| 用户 | `GET /api/v1/users/me` | 当前用户信息 |
| 设备 | `GET /api/v1/devices/list` | 设备列表 |
| | `POST /api/v1/devices/add` | 添加设备 |
| | `PUT /api/v1/devices/:id` | 更新设备 |
| | `DELETE /api/v1/devices/:id` | 删除设备 |
| 睡眠 | `GET /api/sleep/report/daily` | 每日报告 |
| | `GET /api/sleep/stages` | 分期数据 |
| | `GET /api/sleep/noise` | 噪音数据 |
| | `GET /api/sleep/summary` | 摘要统计 |
| 医生 | `GET /api/users/doctors` | 医生列表 |
| 授权 | `POST /api/doctor/grant` | 授权医生 |
| | `DELETE /api/doctor/revoke` | 撤销授权 |
| | `GET /api/doctor/granted` | 已授权列表 |
| | `PUT /api/doctor/confirm` | 确认授权 |
| | `GET /api/doctor/patients` | 患者列表 |
| 干预 | `PUT /api/doctor/note` | 保存建议 |
| | `GET /api/doctor/note` | 获取建议 |

## 测试

### 集成测试

确保后端已启动，运行：

```bash
node backend/test/integration.test.js
```

覆盖 12 个核心场景：注册 → 登录 → 用户信息 → 设备管理 → 睡眠报告 → 分期 → 噪音 → 医生注册 → 授权 → 已授权列表 → 摘要统计。

## 数据库设计

### 核心表（5 张）

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| users | 用户表 | user_id, phone, role |
| devices | 设备表 | device_id, user_id, serial_no, is_virtual |
| sleep_reports | 睡眠报告 | report_id, sleep_score, sleep_stages_json, noise_json |
| user_settings | 用户设置 | bedtime, wakeup_time, sound_enabled |
| doctor_authorizations | 医生授权 | doctor_id, patient_id, status, doctor_note |

详细 ER 图和 DDL 见 [docs/数据库设计.md](docs/数据库设计.md)。

### 性能优化索引

已在 schema.js 中为高频查询字段添加索引：

```sql
-- 睡眠报告复合唯一索引
CREATE UNIQUE INDEX uk_sleep_reports_user_date ON sleep_reports(user_id, report_date);

-- 医生授权复合查询索引
CREATE INDEX idx_doctor_auth_doctor ON doctor_authorizations(doctor_id, status);
CREATE INDEX idx_doctor_auth_patient ON doctor_authorizations(patient_id, status);
```

## MySQL 迁移

项目支持通过环境变量 `DATABASE_TYPE=mysql` 切换到 MySQL：

1. 执行 [docs/migration.sql](docs/migration.sql) 创建表结构
2. 使用 [docs/migrate-data.js](docs/migrate-data.js) 迁移现有 SQLite 数据
3. 设置 `.env` 中的 MySQL 连接参数并重启后端

详见 [connection.js](backend/db/connection.js)。

## 许可证

MIT License
