# flare-image — Cloudflare 免费图床

基于 **Cloudflare Workers + R2** 的零成本图床。上传图片后得到永久链接，支持拖拽 / 粘贴上传、在线管理、Range 请求与边缘缓存。

## 特性

- **原始二进制上传**：`PUT /api/upload` 流式写入 R2，适合大图
- **multipart 上传**：`POST /api/upload`，浏览器和表单友好，支持单次多文件
- **在线管理面板**：访问 `/`，拖拽、粘贴、预览、复制链接 / Markdown、删除
- **游标分页**：列表接口返回 `cursor` 与 `truncated`
- **批量删除**：JSON 一次删除最多 1000 个对象
- **下载优化**：`HEAD`、Range、`If-None-Match` / `If-Match`、`?download=1`
- **边缘缓存**：Worker Cache API + 一年 `Cache-Control`，减少 R2 读取
- **安全**：Bearer Token、定长比较、扩展名白名单、MIME 一致性校验、路径穿越防护、SVG CSP 沙箱

## 架构

```
浏览器 / curl
  │  PUT /api/upload        (Bearer UPLOAD_TOKEN)
  │  GET /api/list          (Bearer ADMIN_TOKEN)
  │  DELETE /api/delete     (Bearer ADMIN_TOKEN)
  ▼
Cloudflare Worker
  │  env.IMAGES.put / get / list / delete
  ▼
R2 Bucket（无出口流量费）
  │  GET /<key>
  ▼
Cache API + CDN 缓存
```

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

> 额度以 Cloudflare 官方最新定价为准。免费计划请求体上限为 100 MB；multipart 会把文件读入 Worker 内存，大文件请优先使用 `PUT` 流式上传。

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

### 3. 配置密钥

线上：

```bash
npx wrangler secret put UPLOAD_TOKEN
npx wrangler secret put ADMIN_TOKEN
```

本地：

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入随机令牌
```

生成随机令牌：

```bash
openssl rand -hex 32
```

`PUBLIC_URL` 是可选项。默认使用请求的 origin 生成图片链接；绑定自定义域名后可在 `wrangler.toml` 中设置：

```toml
[vars]
PUBLIC_URL = "https://images.example.com"
```

### 4. 本地开发

```bash
npm run dev
```

打开 <http://localhost:8787> 使用管理面板。R2 使用本地模拟，不会写入线上桶。

### 5. 类型检查 / 构建校验

```bash
npm run lint
npm test
```

### 6. 部署

```bash
npm run deploy
```

部署后地址形如 `https://<subdomain>.<account>.workers.dev`。可在 Cloudflare 控制台为 Worker 绑定自定义域名。

## 管理面板

访问 Worker 根路径 `/`：

1. 在「令牌」中填入 `UPLOAD_TOKEN`，即可上传；填入 `ADMIN_TOKEN` 可载入列表和删除。
2. 支持点击选择、拖拽到页面任意位置、`Ctrl / ⌘ + V` 粘贴截图。
3. 每张图片提供「复制链接」「Markdown」「删除」。
4. 令牌只保存在浏览器 `localStorage`，不会写入 HTML 或 URL。

> 如果上传和管理的令牌不同，管理面板一次只能使用其中一个。想要完整体验，可把两个 secret 设为同一个值；更安全的做法是上传时填 `UPLOAD_TOKEN`、管理时切换为 `ADMIN_TOKEN`。

## API

所有 JSON 响应都带 CORS 头。错误响应格式：

```json
{ "ok": false, "error": "描述", "code": "ERROR_CODE" }
```

### 上传 — 原始二进制

```http
PUT /api/upload?filename=photo.jpg
Authorization: Bearer <UPLOAD_TOKEN>
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
  "key": "uploads/2026/10/21/a1b2c3d4e5f6.jpg",
  "url": "https://flare-image.example.workers.dev/uploads/2026/10/21/a1b2c3d4e5f6.jpg",
  "size": 123456,
  "contentType": "image/jpeg"
}
```

### 上传 — multipart

```http
POST /api/upload
Authorization: Bearer <UPLOAD_TOKEN>
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
GET /uploads/2026/10/21/a1b2c3d4e5f6.jpg
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
Authorization: Bearer <ADMIN_TOKEN>
```

`limit` 范围 1–1000，默认 100。`prefix` 为空时列出全部对象。

```json
{
  "ok": true,
  "count": 2,
  "truncated": true,
  "cursor": "next-cursor",
  "objects": [
    {
      "key": "uploads/2026/10/21/a1b2c3d4e5f6.jpg",
      "url": "https://images.example.com/uploads/2026/10/21/a1b2c3d4e5f6.jpg",
      "size": 123456,
      "uploaded": "2026-10-21T12:00:00.000Z",
      "etag": "\"abc123\""
    }
  ]
}
```

下一页带上 `cursor` 即可。`truncated` 为 `false` 时表示没有更多数据。

### 删除

单个：

```http
DELETE /api/delete?key=uploads/2026/10/21/a1b2c3d4e5f6.jpg
Authorization: Bearer <ADMIN_TOKEN>
```

批量：

```http
DELETE /api/delete
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{ "keys": ["uploads/...jpg", "uploads/...png"] }
```

也支持 `POST /api/delete` 和 JSON 字段 `key`。单次最多 1000 个。删除后会尝试清理当前数据中心的 Cache API 缓存。

返回：

```json
{
  "ok": true,
  "deleted": ["uploads/...jpg"],
  "key": "uploads/...jpg"
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

- `UPLOAD_TOKEN` 保护上传；`ADMIN_TOKEN` 保护列表与删除
- Token 使用 SHA-256 摘要做定长比较，避免时序侧信道
- Key 仅允许 `[\w./-]`，拒绝 `..`、反斜杠、空段、控制字符
- 扩展名白名单 + 请求 `Content-Type` 必须与扩展名一致
- 单文件不超过 100 MB
- 上传后的响应不会暴露内部配置
- 下载设置 `X-Content-Type-Options: nosniff`
- SVG 使用 `Content-Security-Policy: ...; sandbox` 隔离
- 管理面板使用严格 CSP，令牌存于 `localStorage`
- CORS 仅开放接口，实际写操作仍需要 Bearer Token

> 注意：图片缓存一年。删除操作会清理当前 Worker 数据中心的 Cache API，但浏览器或已存在的其他缓存可能仍保留副本，直到过期。

## 文件结构

```
flare-image/
├── wrangler.toml              # Workers 配置（R2 绑定、可选 PUBLIC_URL）
├── worker-configuration.d.ts  # Env 类型
├── .dev.vars.example          # 本地密钥模板（.dev.vars 已被 gitignore）
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # 路由、下载、缓存、CORS
    ├── upload.ts              # 原始二进制 / multipart 上传
    ├── admin.ts               # 列表、删除、缓存清理
    ├── utils.ts               # 鉴权、校验、URL、条件请求工具
    └── ui.ts                  # 内置管理面板 HTML
```

## 使用示例

### 上传

```bash
curl -X PUT "https://your-worker.workers.dev/api/upload?filename=test.png" \
  -H "Authorization: Bearer your_upload_token" \
  -H "Content-Type: image/png" \
  --data-binary @test.png
```

### 下载 / 下载附件

```bash
curl -o image.png "https://your-worker.workers.dev/uploads/2026/10/21/xxx.png"
curl -OJ "https://your-worker.workers.dev/uploads/2026/10/21/xxx.png?download=1"
```

### 列表

```bash
curl "https://your-worker.workers.dev/api/list?limit=20" \
  -H "Authorization: Bearer your_admin_token"
```

### 批量删除

```bash
curl -X DELETE "https://your-worker.workers.dev/api/delete" \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  --data '{"keys":["uploads/2026/10/21/xxx.png"]}'
```

## 参考

- [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [R2 Public Buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
