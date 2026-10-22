import type { Env } from "../worker-configuration";

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".heic": "image/heic",
};

export const ALLOWED_MIME_TYPES = new Set<string>(Object.values(ALLOWED_EXTENSIONS));

/** Cloudflare Free Plan 单次请求体上限 */
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

/** 一次 multipart 请求最多包含的文件数 */
export const MAX_MULTIPART_FILES = 10;

/** 图片缓存时长: 1 年 */
export const IMAGE_CACHE_MAX_AGE = 60 * 60 * 24 * 365;

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "ETag, Content-Length, Content-Range, Accept-Ranges",
};

export interface UploadResponse {
  ok: true;
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface ListResponse {
  ok: true;
  count: number;
  truncated: boolean;
  cursor: string | null;
  objects: {
    key: string;
    url: string;
    size: number;
    uploaded: string;
    etag: string;
  }[];
}

export interface DeleteResponse {
  ok: true;
  key?: string;
  deleted: string[];
}

export interface ErrorResponse {
  ok: false;
  error: string;
  code?: string;
}

// ─── 响应 ───────────────────────────────────────────────────────

export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit): Response {
  const merged = new Headers(headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    merged.set(key, value);
  }
  merged.set("Content-Type", "application/json; charset=utf-8");
  merged.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: merged });
}

export function errorResponse(error: string, status: number, code?: string): Response {
  return jsonResponse({ ok: false, error, code } satisfies ErrorResponse, status);
}

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Range, If-None-Match, If-Match, X-Filename",
      "Access-Control-Expose-Headers": "ETag, Content-Length, Content-Range, Accept-Ranges",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function methodNotAllowed(allow: string): Response {
  const response = errorResponse("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
  response.headers.set("Allow", allow);
  return response;
}

// ─── 鉴权 ───────────────────────────────────────────────────────

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() || null : null;
}

/**
 * 对 SHA-256 摘要做定长比较, 避免 Token 比较泄露时序信息。
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

/**
 * 校验请求 Token。通过返回 null, 否则返回错误响应。
 */
export async function authorize(
  request: Request,
  expectedToken: string | undefined,
  hint: string
): Promise<Response | null> {
  if (!expectedToken) {
    return errorResponse(
      `${hint} is not configured on the server`,
      500,
      "TOKEN_NOT_CONFIGURED"
    );
  }
  const token = extractBearerToken(request);
  if (!token || !(await timingSafeEqual(token, expectedToken))) {
    return errorResponse("Missing or invalid Authorization header", 401, "UNAUTHORIZED");
  }
  return null;
}

// ─── 文件名 / Key ───────────────────────────────────────────────

export function validateFileExtension(filename: string): { ext: string; mime: string } | null {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) return null;
  const ext = filename.slice(dotIndex).toLowerCase();
  if (ext.length > 10) return null;
  const mime = ALLOWED_EXTENSIONS[ext];
  return mime ? { ext, mime } : null;
}

/**
 * 防路径穿越。允许字母、数字、- _ . /, 禁止 `..`、反斜杠与控制字符。
 */
export function sanitizeKey(key: string): string | null {
  if (!key || key.length > 512) return null;
  if (key.startsWith("/") || key.endsWith("/")) return null;
  if (key.includes("..") || key.includes("\\") || key.includes("//")) return null;
  if (/[\x00-\x1f\x7f]/.test(key)) return null;
  if (!/^[\w./-]+$/.test(key)) return null;
  const segments = key.split("/");
  if (segments.some((segment) => segment === "." || segment === ".." || segment === "")) {
    return null;
  }
  return key;
}

/** 与 sanitizeKey 类似, 但允许以 "/" 结尾 (用于 list prefix)。空字符串表示列出全部。 */
export function sanitizePrefix(prefix: string): string | null {
  if (prefix === "") return "";
  if (prefix.length > 512) return null;
  if (prefix.startsWith("/") || prefix.includes("..") || prefix.includes("\\") || prefix.includes("//")) {
    return null;
  }
  if (/[\x00-\x1f\x7f]/.test(prefix)) return null;
  if (!/^[\w./-]+$/.test(prefix)) return null;
  const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  if (!trimmed) return null;
  if (trimmed.split("/").some((segment) => segment === "." || segment === ".." || segment === "")) {
    return null;
  }
  return prefix;
}

export function generateKey(ext: string, now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const random = crypto.randomUUID().replace(/-/g, "");
  return `uploads/${year}/${month}/${day}/${random}${ext}`;
}

/** 从 `Content-Disposition` 头里取文件名 (支持 filename*)。 */
export function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      return null;
    }
  }
  const quoted = /filename\s*=\s*"([^"]*)"/i.exec(header);
  if (quoted) return quoted[1] || null;
  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  return plain ? plain[1].trim() || null : null;
}

// ─── Content-Type ───────────────────────────────────────────────

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/vnd.microsoft.icon": "image/x-icon",
  "image/tif": "image/tiff",
};

export function normalizeContentType(value: string | null | undefined): string | null {
  if (!value) return null;
  const base = value.split(";")[0].trim().toLowerCase();
  if (!base) return null;
  return MIME_ALIASES[base] ?? base;
}

/**
 * 请求声明的 Content-Type 必须与扩展名推导出的类型一致。
 * 允许 application/octet-stream, 方便 curl / 命令行客户端。
 */
export function isContentTypeAllowed(provided: string | null | undefined, expected: string): boolean {
  const normalized = normalizeContentType(provided);
  if (!normalized) return true;
  if (normalized === "application/octet-stream") return true;
  if (normalized === "binary/octet-stream") return true;
  return normalized === expected;
}

export function defaultFilename(contentType: string | null | undefined): string | null {
  const normalized = normalizeContentType(contentType);
  if (!normalized) return null;
  for (const [ext, mime] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (mime === normalized) return `upload${ext}`;
  }
  return null;
}

// ─── URL ────────────────────────────────────────────────────────

/** PUBLIC_URL 未配置时回退到当前请求的 origin。 */
export function getPublicUrl(request: Request, env: Env): string {
  const configured = env.PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function objectUrl(request: Request, env: Env, key: string): string {
  return `${getPublicUrl(request, env)}/${key}`;
}

// ─── Cache API ──────────────────────────────────────────────────

/**
 * tsconfig 同时引入了 DOM 类型, 这里的 CacheStorage 定义与 Workers 不同,
 * 通过断言拿到 Workers 的 caches.default。
 */
export function getEdgeCache(): Cache | null {
  try {
    const storage = caches as unknown as { default?: Cache };
    return storage.default ?? null;
  } catch {
    return null;
  }
}

// ─── Etag / 条件请求 ────────────────────────────────────────────

function normalizeEtag(value: string): string {
  return value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
}

export function etagMatches(headerValue: string, etag: string): boolean {
  const target = normalizeEtag(etag);
  if (headerValue.trim() === "*") return true;
  return headerValue
    .split(",")
    .map(normalizeEtag)
    .some((candidate) => candidate === target);
}

export function hasConditionalHeaders(request: Request): boolean {
  return (
    request.headers.has("if-match") ||
    request.headers.has("if-none-match") ||
    request.headers.has("if-modified-since") ||
    request.headers.has("if-unmodified-since")
  );
}

/**
 * R2 的 onlyIf 条件失败时只返回元数据 (无 body), 这里推断应返回 304 还是 412。
 */
export function conditionalStatus(request: Request, uploaded: Date, etag: string): 304 | 412 {
  const ifMatch = request.headers.get("if-match");
  if (ifMatch && !etagMatches(ifMatch, etag)) return 412;

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && etagMatches(ifNoneMatch, etag)) return 304;

  const ifModifiedSince = request.headers.get("if-modified-since");
  if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    if (!Number.isNaN(since) && Math.floor(uploaded.getTime() / 1000) <= Math.floor(since / 1000)) {
      return 304;
    }
  }

  const ifUnmodifiedSince = request.headers.get("if-unmodified-since");
  if (ifUnmodifiedSince) {
    const since = Date.parse(ifUnmodifiedSince);
    if (!Number.isNaN(since) && uploaded.getTime() > since + 999) return 412;
  }

  return 412;
}
