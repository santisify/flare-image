# flare-image — Cloudflare 免费图床

基于 **Cloudflare Workers + R2** 的零成本图床。使用管理员 / 用户账号密码登录，支持拖拽 / 粘贴上传、在线管理、Range 请求与边缘缓存。

## 特性

- **账号密码登录**：不再使用静态上传 Token
- **两种角色**：
  - 管理员：上传，查看全部图片，删除任意图片
  - 用户：上传，只能查看 / 删除自己的图片
- **原始二进制上传**：`PUT /api/upload` 流式写入 R2，适合大图
- **multipart 上传**：`POST /api/upload`，浏览器和表单友好，单次最多 10 个文件
- **在线管理面板**：访问 `/`，拖拽、粘贴、预览、复制链接 / Markdown、删除
- **游标分页**：列表接口返回 `cursor` 与 `truncated`
- **批量删除**：JSON 一次删除最多 1000 个对象
- **下载优化**：`HEAD`、Range、`If-None-Match` / `If-Match`、`?download=1`
- **边缘缓存**：Worker Cache API + 一年 `Cache-Control`，减少 R2 读取
- **安全**：HttpOnly 会话 Cookie、HMAC 签名、定长密码比较、扩展名白名单、MIME 校验、路径穿越防护、SVG CSP 沙箱

## 架构

```
浏览器
  │  POST /api/login {username,password}
  │  PUT  /api/upload        (Cookie 或 Basic Auth)
  │  GET  /api/list          (用户仅自己的图片)
  │  DELETE /api/delete      (用户仅自己的图片)
  ▼
Cloudflare Worker
  │  env.IMAGES.put / get / list / delete
  ▼
R2 Bucket（无出口流量费）
  │  GET /<key>
  ▼
Cache API + CDN 缓存
```

## 角色与目录

| 角色 | 上传目录 | 列表范围 | 删除范围 |
|------|----------|----------|----------|
| `admin` | `uploads/admin/...` | `uploads/` 全部 | 任意 key |
| `user` | `uploads/user/...` | `uploads/user/` 自己的图片 | 仅 `uploads/user/` |

> 当前只配置一个 `user` 账号。如果多人共用这个账号，他们会看到彼此的图片。要做到每人独立账号，需要引入数据库或 Cloudflare Access。

## 免费额度

| 资源 | 免费额度 |
|------|---------|
| Workers 请求 | 100,000 次/天，10 ms CPU / 次 |
| Workers 请求体 | 单次 100 MB |
| R2 存储 | 10 GB-month |
| R2 Class A（写 / 列表） | 1,000,000 次/月 |
| R2 Class B（读） | 10,000,000 次/月 |
| R2 出口流量 | **0 费用** |
| 单文件大小 | ≤ 100 MB（受 Worker 请求体限制） |

> 额度以 Cloudflare 官方最新定价为准。大文件请优先使用 `PUT` 流式上传；multipart 会把文件读入 Worker 内存。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 R2 桶

```bash
npx wrangler r2 bucket create flare-images
```

如果修改了桶名，请同步修改 `wrangler.toml` 中的 `bucket_name`。

### 3. 配置账号

管理员和用户账号通过环境变量配置：

```env
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="一个足够长的管理员密码"
USER_USERNAME="user"
USER_PASSWORD="一个足够长的用户密码"
```

生产方式二选一：

**方式 A：wrangler.toml（简单，但密码会进入仓库）**

```toml
[vars]
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "change-me-admin"
USER_USERNAME = "user"
USER_PASSWORD = "change-me-user"
```

**方式 B：用户名用变量，密码用 Secret（推荐）**

`wrangler.toml`：

```toml
[vars]
ADMIN_USERNAME = "admin"
USER_USERNAME = "user"
```

终端：

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put USER_PASSWORD
```

也可以直接在 Cloudflare 控制台：

```text
Worker → Settings → Variables and Secrets
```

把 `ADMIN_PASSWORD`、`USER_PASSWORD` 添加为 **Secret**。

可选会话密钥：

```bash
npx wrangler secret put SESSION_SECRET
```

不设置时会从账号密码派生。修改账号密码或 `SESSION_SECRET` 会使已有登录会话失效。

本地开发：

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入账号密码
```

### 4. 本地开发

```bash
npm run dev
```

打开 <http://localhost:8787>，使用配置的账号登录。本地 R2 使用 Miniflare 模拟，不会写入线上桶。

### 5. 类型检查 / 构建校验

```bash
npm run lint
npm test
```

### 6. 部署

```bash
npm run deploy
```

部署后地址形如 `https://<subdomain>.<account>.workers.dev`。

如果使用 GitHub → Cloudflare Workers Builds，参考下面的「GitHub 自动部署」。

## 管理面板

访问 Worker 根路径 `/`：

1. 输入管理员或用户账号密码登录
2. 支持点击选择、拖拽到页面任意位置、`Ctrl / ⌘ + V` 粘贴截图
3. 每张图片提供「复制链接」「Markdown」「删除」
4. 管理员看到全部图片，用户只看到自己的图片
5. 登录状态保存在 HttpOnly Cookie，页面不保存密码

## API

### 登录

```http
POST /api/login
Content-Type: application/json

{"username":"admin","password":"..."}
```

成功返回并设置 `flare_session` Cookie：

```json
{
  "ok": true,
  "user": { "username": "admin", "role": "admin" }
}
```

### 当前用户 / 退出

```http
GET  /api/me
POST /api/logout
```

### API 客户端认证

除浏览器 Cookie 外，也支持 HTTP Basic Auth：

```bash
curl -u "admin:你的密码" https://你的地址/api/list
```

### 上传 — 原始二进制

```http
PUT /api/upload?filename=photo.jpg
Content-Type: image/jpeg

<binary body>
```

文件名也可以来自：

- `X-Filename: photo.jpg`
- `Content-Disposition: attachment; filename="photo.jpg"`
- 未提供文件名时，根据 `Content-Type` 推断扩展名

`Content-Type` 为 `application/octet-stream` 时按扩展名写入。

返回 `201 Created`：

```json
{
  "ok": true,
  "key": "uploads/admin/2026/10/21/a1b2c3d4e5f6.jpg",
  "url": "https://flare-image.example.workers.dev/uploads/admin/2026/10/21/a1b2c3d4e5f6.jpg",
  "size": 123456,
  "contentType": "image/jpeg"
}
```

### 上传 — multipart

```http
POST /api/upload
Content-Type: multipart/form-data; boundary=...
```

Form 字段：

- `file`：文件，可重复（单次最多 10 个）
- `filename`：可选，仅在单个文件时覆盖文件名

单个文件返回同上；多个文件返回：

```json
{
  "ok": true,
  "count": 2,
  "files": [
    { "ok": true, "key": "...", "url": "...", "size": 1, "contentType": "image/png" }
  ]
}
```

### 下载

```http
GET /uploads/admin/2026/10/21/a1b2c3d4e5f6.jpg
```

- 支持 `HEAD`
- 支持 `Range: bytes=0-1023` → `206` + `Content-Range`
- 支持 `If-None-Match` / `If-Modified-Since` → `304`
- 支持 `If-Match` / `If-Unmodified-Since` → 条件失败时 `412`
- 加 `?download=1` 返回 `Content-Disposition: attachment`
- 缓存头为一年 `immutable`，同时写入 Worker Cache API
- SVG 响应附带 CSP 沙箱，避免脚本在 Worker 域名执行

### 列表

```http
GET /api/list?prefix=uploads/&limit=100&cursor=<cursor>
```

- 管理员默认列出 `uploads/` 全部
- 用户默认只列出 `uploads/user/`，传其他前缀会返回 `403`
- `limit` 范围 1–1000，默认 100

```json
{
  "ok": true,
  "count": 2,
  "truncated": true,
  "cursor": "next-cursor",
  "objects": [
    {
      "key": "uploads/user/2026/10/21/a1b2c3d4e5f6.jpg",
      "url": "https://images.example.com/uploads/user/2026/10/21/a1b2c3d4e5f6.jpg",
      "size": 123456,
      "uploaded": "2026-10-21T12:00:00.000Z",
      "etag": "\"abc123\""
    }
  ]
}
```

下一页带上 `cursor` 即可。

### 删除

单个：

```http
DELETE /api/delete?key=uploads/user/2026/10/21/a1b2c3d4e5f6.jpg
```

批量：

```http
DELETE /api/delete
Content-Type: application/json

{ "keys": ["uploads/user/...jpg", "uploads/user/...png"] }
```

也支持 `POST /api/delete` 和 JSON 字段 `key`。单次最多 1000 个。

- 管理员可删除任意图片
- 用户只能删除 `uploads/user/` 下的图片

返回：

```json
{
  "ok": true,
  "deleted": ["uploads/user/...jpg"],
  "key": "uploads/user/...jpg"
}
```

### 其他

```http
GET /health     # 健康检查
GET /api        # 接口、限制、允许的扩展名
OPTIONS /api/*  # CORS 预检
```

## 支持的文件格式

| 扩展名 | MIME 类型 |
|--------|----------|
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.avif` | `image/avif` |
| `.svg` | `image/svg+xml` |
| `.bmp` | `image/bmp` |
| `.ico` | `image/x-icon` |
| `.tiff` / `.tif` | `image/tiff` |
| `.heic` | `image/heic` |

扩展名不在白名单内会返回 `400 INVALID_EXTENSION`。

## 安全设计

- 账号密码来自环境变量；密码比较使用 SHA-256 定长比较
- 登录成功后签发 HMAC 签名的 HttpOnly Cookie，有效期 7 天
- 生产环境 Cookie 自动带上 `Secure`，并设置 `SameSite=Lax`
- 支持 HTTP Basic Auth 供 API 客户端使用
- 用户只能列出 / 删除 `uploads/user/` 下的对象
- Key 仅允许 `[\w./-]`，拒绝 `..`、反斜杠、空段、控制字符
- 扩展名白名单 + 请求 `Content-Type` 必须与扩展名一致
- 单文件不超过 100 MB
- 下载设置 `X-Content-Type-Options: nosniff`
- SVG 使用 `Content-Security-Policy: ...; sandbox` 隔离
- 管理面板使用严格 CSP，密码不进入 HTML / localStorage

> 注意：登录接口本身没有内置速率限制。个人使用问题不大；如果直接暴露在公网，建议叠加 Cloudflare Access、WAF Rate Limiting 或 Turnstile。
>
> 图片缓存一年。删除操作会清理当前 Worker 数据中心的 Cache API，但浏览器或已存在的其他缓存可能仍保留副本，直到过期。

## GitHub 自动部署

1. 把仓库推送到 GitHub
2. Cloudflare 控制台 → **Workers & Pages** → **Create application** → **GitHub**
3. 选择仓库
4. 配置：

| 配置项 | 值 |
|--------|-----|
| Worker 名称 | `flare-image`（必须与 `wrangler.toml` 的 `name` 一致） |
| 生产分支 | `main` |
| Root directory | `/` |
| Build command | 留空，或 `npm run lint` |
| Deploy command | `npx wrangler deploy` |
| Preview builds | 建议关闭 |

5. 在 **Settings → Variables and Secrets** 添加账号配置
6. 推送提交触发构建

Workers Builds 会自动安装 `package.json` 中的依赖，不需要把 `npm install` 写进构建命令。

## 文件结构

```
flare-image/
├── wrangler.toml              # Workers 配置（R2 绑定、可选 PUBLIC_URL）
├── worker-configuration.d.ts  # Env 类型
├── .dev.vars.example          # 本地账号模板（.dev.vars 已被 gitignore）
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # 路由、下载、缓存、CORS
    ├── auth.ts                # 登录、会话、角色鉴权
    ├── upload.ts              # 原始二进制 / multipart 上传
    ├── admin.ts               # 列表、删除、缓存清理
    ├── utils.ts               # 校验、URL、条件请求工具
    └── ui.ts                  # 内置管理面板 HTML
```

## 使用示例

### 登录并保存 Cookie

```bash
curl -c cookies.txt -X POST "https://你的地址/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"你的密码"}'
```

### 上传

```bash
curl -b cookies.txt -X PUT "https://你的地址/api/upload?filename=test.png" \
  -H "Content-Type: image/png" \
  --data-binary @test.png
```

或者使用 Basic Auth：

```bash
curl -u "admin:你的密码" -X PUT "https://你的地址/api/upload?filename=test.png" \
  -H "Content-Type: image/png" \
  --data-binary @test.png
```

### 列表

```bash
curl -u "admin:你的密码" "https://你的地址/api/list?limit=20"
```

### 批量删除

```bash
curl -u "admin:你的密码" -X DELETE "https://你的地址/api/delete" \
  -H "Content-Type: application/json" \
  --data '{"keys":["uploads/user/2026/10/21/xxx.png"]}'
```

### 下载附件

```bash
curl -OJ "https://你的地址/uploads/user/2026/10/21/xxx.png?download=1"
```

## 参考

- [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
