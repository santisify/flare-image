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


/** Cloudflare Free Plan 单次请求体上限 */
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

/** 一次 multipart 请求最多包含的文件数 */
export const MAX_MULTIPART_FILES = 10;

/** 一次批量删除最多包含的 key 数 */
export const MAX_DELETE_KEYS = 1000;

/** 图片缓存时长: 1 年 */
export const IMAGE_CACHE_MAX_AGE = 60 * 60 * 24 * 365;
