import type { Env } from "../../worker-configuration";
import { ALLOWED_EXTENSIONS, THUMB_PREFIX } from "./constants";

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

export function generateKey(ext: string, prefix = "upload/file"): string {
  const random = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}/${random}${ext}`;
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

/** 缩略图对象 key: `.thumbs/<原图 key>.thumb` */
export function thumbKey(key: string): string {
  return `${THUMB_PREFIX}${key}.thumb`;
}

/** 缩略图 URL: 原图 URL 加 `?thumb=1`, 由 Worker 决定返回缩略图还是原图 */
export function thumbUrl(request: Request, env: Env, key: string): string {
  return `${objectUrl(request, env, key)}?thumb=1`;
}
