# 睡眠评估干预系统 - 后端服务

基于 Express + sql.js + SQLite 的后端 API 服务，支撑睡眠评估干预系统的用户体系。

## 技术栈

- **运行时**：Node.js 18+
- **Web 框架**：Express 4.x
- **数据库**：SQLite (通过 sql.js)
- **认证**：JWT (jsonwebtoken)
- **密码加密**：bcryptjs
- **跨域**：cors
- **配置**：dotenv
- **开发热重载**：nodemon

## 目录结构

```
backend/
├── app.js              # Express 入口，注册/登录 API
├── package.json        # 项目依赖与脚本
├── .gitignore          # 忽略 node_modules 等
└── db/
    ├── connection.js   # sql.js 连接管理 + 持久化
    ├── schema.js       # 数据库表结构定义
    └── init.js         # 独立初始化脚本
```

## 安装依赖

```bash
cd backend
npm install
```

依赖会安装到 `backend/node_modules/`（虚拟环境隔离）。

## 数据库文件

`sql.js` 默认是内存数据库，本项目在 `connection.js` 中通过 `db.export()` 手动将内存数据库导出到文件：

- **路径**：`d:\Android\project\sleep-care\sleep_care.db`（项目根目录）
- **生成时机**：首次启动时自动创建并执行 schema
- **持久化时机**：每次写操作后通过 `scheduleSave()` 防抖写盘

## 启动服务

### 开发模式（nodemon 热重载）

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

服务默认监听 `http://localhost:3000`。

## API 文档

### 根路径

```
GET /
```

返回服务基本信息。

**响应示例：**
```json
{
  "code": 0,
  "message": "Sleep Care Backend is running",
  "data": {
    "name": "sleep-care-backend",
    "version": "1.0.0",
    "endpoints": ["POST /api/v1/auth/register", "POST /api/v1/auth/login"]
  }
}
```

### 用户注册

```
POST /api/v1/auth/register
Content-Type: application/json
```

**请求体：**
```json
{
  "phone": "13800138000",
  "password": "123456",
  "nickname": "测试用户",
  "gender": 0,
  "birth_year": 1990
}
```

**成功响应 (code: 0)：**
```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "user": {
      "user_id": 1,
      "phone": "13800138000",
      "nickname": "测试用户",
      "gender": 0,
      "birth_year": 1990,
      "role": 0,
      "status": 0,
      "created_at": "2026-06-22 11:18:47"
    }
  }
}
```

**失败响应 (code: 409)：**
```json
{ "code": 409, "message": "该手机号已注册", "data": null }
```

### 用户登录

```
POST /api/v1/auth/login
Content-Type: application/json
```

**请求体：**
```json
{ "phone": "13800138000", "password": "123456" }
```

**成功响应 (code: 0)：**
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "user_id": 1, "phone": "13800138000", "nickname": "测试用户", "role": 0 }
  }
}
```

**失败响应 (code: 401)：**
```json
{ "code": 401, "message": "密码错误", "data": null }
```

### 获取当前用户（受保护示例）

```
GET /api/v1/users/me
Authorization: Bearer <token>
```

## Postman 测试用例

| 场景 | Method | URL | Body / Headers |
|------|--------|-----|----------------|
| 1. 根路径 | GET | `http://localhost:3000/` | - |
| 2. 新用户注册 | POST | `http://localhost:3000/api/v1/auth/register` | `{"phone":"13800138000","password":"123456","nickname":"测试用户"}` |
| 3. 重复注册 | POST | `http://localhost:3000/api/v1/auth/register` | `{"phone":"13800138000","password":"123456"}` |
| 4. 正确登录 | POST | `http://localhost:3000/api/v1/auth/login` | `{"phone":"13800138000","password":"123456"}` |
| 5. 错误密码 | POST | `http://localhost:3000/api/v1/auth/login` | `{"phone":"13800138000","password":"wrongpass"}` |
| 6. 受保护接口 | GET | `http://localhost:3000/api/v1/users/me` | `Authorization: Bearer <token>` |

## 响应码规范

| 业务码 | 含义 |
|--------|------|
| 0 | 成功 |
| 400 | 参数错误 |
| 401 | 未认证 / 密码错误 |
| 403 | 账户被禁用 |
| 404 | 用户不存在 |
| 409 | 手机号已注册 |
| 500 | 服务器内部错误 |

## 环境变量

复制 `.env.example` 为 `.env` 并按需修改：

```
PORT=3000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```
