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

/**
 * 缩略图对象前缀。
 *
 * 必须排在 `upload/`、`uploads/` 之后: R2 list 按 key 字典序返回,
 * 前缀若以 "." 开头会排到最前面, 把第一页的图片全部挤掉, 导致图库空白。
 * "~" (0x7E) 排在所有字母之后。
 */
export const THUMB_PREFIX = "~thumbs/";

/** 早期版本写入的缩略图前缀, 读取时兼容 */
export const LEGACY_THUMB_PREFIX = ".thumbs/";

/** 缩略图对象体积上限 (浏览器端生成, 通常 < 100 KB) */
export const MAX_THUMB_SIZE = 1024 * 1024;

/** 允许写入的缩略图类型 (canvas 能导出的格式) */
export const THUMB_CONTENT_TYPES = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/avif",
]);
