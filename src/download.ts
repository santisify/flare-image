import type { Env } from "../worker-configuration";
import { getEdgeCache } from "./lib/cache";
import { IMAGE_CACHE_MAX_AGE } from "./lib/constants";
import {
  conditionalStatus,
  errorResponse,
  hasConditionalHeaders,
  notFoundResponse,
  withCors,
} from "./lib/http";
import { sanitizeKey, thumbKey } from "./lib/keys";

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

function buildDownloadHeaders(object: R2Object, key: string, requestUrl: URL): Headers {
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

/**
 * 返回缩略图响应; 不存在时返回 null, 由调用方回退到原图。
 * 缩略图体积小, 一律整段返回, 不处理 Range。
 */
async function buildThumbResponse(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  key: string,
  cacheKey: Request,
  cache: Cache | null,
  isHead: boolean
): Promise<Response | null> {
  let thumb: R2ObjectBody | null;
  try {
    thumb = await env.IMAGES.get(thumbKey(key));
  } catch (err) {
    console.error("R2 thumb get failed", err);
    return null;
  }
  if (!thumb) return null;

  const headers = new Headers();
  thumb.writeHttpMetadata(headers);
  headers.set("etag", thumb.httpEtag);
  if (!headers.has("content-type")) headers.set("content-type", "image/webp");
  headers.set(
    "cache-control",
    `public, max-age=${IMAGE_CACHE_MAX_AGE}, s-maxage=${IMAGE_CACHE_MAX_AGE}, immutable`
  );
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-flare-thumb", "1");
  headers.set("content-length", String(thumb.size));

  const response = withCors(
    new Response(isHead ? null : thumb.body, { status: 200, headers })
  );

  if (!isHead && cache) {
    ctx.waitUntil(
      cache.put(cacheKey, response.clone()).catch((err: unknown) => {
        console.error("Cache put failed", err);
      })
    );
  }
  return response;
}

/** GET|HEAD /<key> */
export async function handleDownload(
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
  const wantsThumb = url.searchParams.get("thumb") === "1";
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

  if (wantsThumb) {
    const thumbResponse = await buildThumbResponse(
      request,
      env,
      ctx,
      key,
      cacheKey,
      cache,
      isHead
    );
    if (thumbResponse) return thumbResponse;
    // 没有缩略图 (旧图片 / API 上传 / GIF 等) → 回退原图, 只做短缓存,
    // 便于浏览器端补生成缩略图后很快拿到新版本。
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
  if (wantsThumb) {
    // 缩略图缺失时的原图兜底: 短缓存 (5 分钟), 避免补生成后仍长时间命中旧内容。
    headers.set("cache-control", "public, max-age=300, s-maxage=300");
    headers.set("x-flare-thumb", "0");
  }

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
