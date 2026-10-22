/**
 * flare-image - Cloudflare Workers + R2 图床
 *
 * 路由:
 *   GET    /                       管理面板 (HTML)
 *   GET    /health                 健康检查
 *   GET    /api                    接口与限制说明
 *   PUT    /api/upload             原始二进制上传 (UPLOAD_TOKEN)
 *   POST   /api/upload             multipart 上传 (UPLOAD_TOKEN)
 *   GET    /api/list               列表 + 游标分页 (ADMIN_TOKEN)
 *   DELETE /api/delete             单个 / 批量删除 (ADMIN_TOKEN)
 *   GET    /<key>                  图片读取 (Range / 条件请求 / 缓存)
 *   HEAD   /<key>                  只读元数据
 */

import type { Env } from "../worker-configuration";
import { handleDelete, handleList } from "./admin";
import { handleMultipartUpload, handleRawUpload } from "./upload";
import { DASHBOARD_HTML } from "./ui";
import {
  ALLOWED_EXTENSIONS,
  IMAGE_CACHE_MAX_AGE,
  MAX_MULTIPART_FILES,
  MAX_UPLOAD_SIZE,
  conditionalStatus,
  corsPreflightResponse,
  errorResponse,
  getEdgeCache,
  hasConditionalHeaders,
  jsonResponse,
  methodNotAllowed,
  sanitizeKey,
  withCors,
} from "./utils";

const DASHBOARD_CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function notFoundResponse(): Response {
  return withCors(
    new Response("Not Found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  );
}

function handleDashboard(method: string): Response {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
    "Content-Security-Policy": DASHBOARD_CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  return new Response(method === "HEAD" ? null : DASHBOARD_HTML, { headers });
}

function handleHealth(): Response {
  return jsonResponse({
    ok: true,
    status: "healthy",
    service: "flare-image",
    timestamp: new Date().toISOString(),
  });
}

function handleApiIndex(): Response {
  return jsonResponse({
    ok: true,
    service: "flare-image",
    version: "1.1.0",
    endpoints: {
      upload: "PUT|POST /api/upload",
      list: "GET /api/list?prefix=&limit=&cursor=",
      delete: "DELETE /api/delete?key= (or JSON {keys})",
      download: "GET|HEAD /<key>",
    },
    limits: {
      maxUploadSize: MAX_UPLOAD_SIZE,
      maxMultipartFiles: MAX_MULTIPART_FILES,
      allowedExtensions: Object.keys(ALLOWED_EXTENSIONS),
    },
  });
}

interface ResolvedRange {
  start: number;
  end: number;
}

function resolveRange(range: R2Range, size: number): ResolvedRange {
  if ("suffix" in range) {
    const length = Math.max(0, Math.min(range.suffix, size));
    return { start: size - length, end: size - 1 };
  }
  const start = Math.max(0, Math.min(range.offset ?? 0, Math.max(0, size - 1)));
  const length = typeof range.length === "number" ? range.length : size - start;
  const end = Math.min(size - 1, start + Math.max(0, length) - 1);
  return { start, end };
}

function buildDownloadHeaders(
  object: R2Object,
  key: string,
  requestUrl: URL
): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");
  if (!headers.has("cache-control")) {
    headers.set(
      "cache-control",
      `public, max-age=${IMAGE_CACHE_MAX_AGE}, s-maxage=${IMAGE_CACHE_MAX_AGE}, immutable`
    );
  }

  const contentType = headers.get("content-type") ?? "";
  if (contentType.toLowerCase().startsWith("image/svg")) {
    // SVG 可能包含脚本, 用 CSP 沙箱隔离, 避免在 Worker 域名下执行。
    headers.set(
      "content-security-policy",
      "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    );
  }

  if (requestUrl.searchParams.has("download")) {
    const original =
      object.customMetadata?.originalFilename || key.split("/").pop() || "image";
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(original)}`);
  }
  return headers;
}

/** GET|HEAD /<key> */
async function handleDownload(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return errorResponse("Invalid key encoding", 400, "INVALID_KEY");
  }
  if (!sanitizeKey(key)) {
    return errorResponse("Invalid key", 400, "INVALID_KEY");
  }

  const method = request.method.toUpperCase();
  const isHead = method === "HEAD";
  const hasRange = request.headers.has("range");
  const canUseCache = !isHead && !hasRange && !hasConditionalHeaders(request);
  const cacheKey = new Request(url.toString(), { method: "GET" });

  const cache = getEdgeCache();
  if (canUseCache && cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return withCors(cached);
    } catch {
      // Cache API 不可用时直接回源。
    }
  }

  let object: R2ObjectBody | R2Object | null;
  try {
    // 不能无条件把 request.headers 作为 range 传入, 否则 R2 会返回整段 206。
    if (hasConditionalHeaders(request)) {
      object = await env.IMAGES.get(key, {
        ...(hasRange ? { range: request.headers } : {}),
        onlyIf: request.headers,
      });
    } else {
      object = await env.IMAGES.get(
        key,
        hasRange ? { range: request.headers } : undefined
      );
    }
  } catch (err) {
    console.error("R2 get failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`R2 read failed: ${message}`, 500, "R2_ERROR");
  }

  if (object === null) return notFoundResponse();

  const headers = buildDownloadHeaders(object, key, url);

  // onlyIf 条件失败时 R2 返回没有 body 的 R2Object。
  if (!("body" in object)) {
    const status = conditionalStatus(request, object.uploaded, object.httpEtag);
    return withCors(new Response(null, { status, headers }));
  }

  if (isHead) {
    headers.set("content-length", String(object.size));
    return withCors(new Response(null, { status: 200, headers }));
  }

  let status = 200;
  if (hasRange && object.range && object.size > 0) {
    const { start, end } = resolveRange(object.range, object.size);
    headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    headers.set("content-length", String(end - start + 1));
    status = 206;
  } else {
    headers.set("content-length", String(object.size));
  }

  const response = withCors(new Response(object.body, { status, headers }));

  if (canUseCache && cache && status === 200) {
    ctx.waitUntil(
      cache.put(cacheKey, response.clone()).catch((err: unknown) => {
        console.error("Cache put failed", err);
      })
    );
  }

  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    try {
      if (method === "OPTIONS") {
        return corsPreflightResponse();
      }

      if ((url.pathname === "/" || url.pathname === "/dashboard") && (method === "GET" || method === "HEAD")) {
        return handleDashboard(method);
      }

      if (url.pathname === "/favicon.ico") {
        return new Response(null, { status: 204 });
      }

      if (url.pathname === "/health" && method === "GET") {
        return handleHealth();
      }

      if (url.pathname === "/api" && method === "GET") {
        return handleApiIndex();
      }

      if (url.pathname === "/api/upload") {
        if (method === "PUT") return await handleRawUpload(request, env);
        if (method === "POST") return await handleMultipartUpload(request, env);
        return methodNotAllowed("PUT, POST, OPTIONS");
      }

      if (url.pathname === "/api/list") {
        if (method === "GET") return await handleList(request, env);
        return methodNotAllowed("GET, OPTIONS");
      }

      if (url.pathname === "/api/delete") {
        if (method === "DELETE" || method === "POST") {
          return await handleDelete(request, env, ctx);
        }
        return methodNotAllowed("DELETE, POST, OPTIONS");
      }

      if (url.pathname.startsWith("/api/")) {
        return errorResponse("API endpoint not found", 404, "NOT_FOUND");
      }

      if (method === "GET" || method === "HEAD") {
        return await handleDownload(request, env, ctx);
      }

      return methodNotAllowed("GET, HEAD, PUT, POST, DELETE, OPTIONS");
    } catch (err) {
      console.error("Unhandled error", err);
      return errorResponse("Internal Server Error", 500, "INTERNAL_ERROR");
    }
  },
} satisfies ExportedHandler<Env>;
