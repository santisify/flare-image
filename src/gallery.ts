import type { Env } from "../worker-configuration";
import { requireAuth, storagePrefix } from "./auth";
import { getEdgeCache } from "./lib/cache";
import { MAX_DELETE_KEYS, THUMB_PREFIX } from "./lib/constants";
import { errorResponse, jsonResponse } from "./lib/http";
import type { DeleteResponse, ListResponse } from "./lib/http";
import {
  getPublicUrl,
  objectUrl,
  sanitizeKey,
  sanitizePrefix,
  thumbKey,
  thumbUrl,
} from "./lib/keys";

function cacheKeysFor(request: Request, env: Env, key: string): Request[] {
  const urls = new Set<string>([new URL(`/${key}`, request.url).toString()]);
  const publicUrl = getPublicUrl(request, env);
  urls.add(`${publicUrl}/${key}`);
  return [...urls].map((url) => new Request(url, { method: "GET" }));
}

function purgeCache(ctx: ExecutionContext, request: Request, env: Env, key: string): void {
  const cache = getEdgeCache();
  if (!cache) return;
  const keys = cacheKeysFor(request, env, key);
  // 缩略图 URL 也带 ?thumb=1, 一并清掉。
  for (const cacheKey of cacheKeysFor(request, env, key)) {
    const thumbCacheKey = new URL(cacheKey.url);
    thumbCacheKey.searchParams.set("thumb", "1");
    keys.push(new Request(thumbCacheKey.toString(), { method: "GET" }));
  }
  ctx.waitUntil(
    Promise.all(keys.map((cacheKey) => cache.delete(cacheKey).catch(() => undefined))).then(
      () => undefined
    )
  );
}

async function parseDeleteKeys(request: Request): Promise<string[] | Response> {
  const url = new URL(request.url);
  const keys: string[] = [];
  const single = url.searchParams.get("key");
  if (single) keys.push(single);

  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.toLowerCase().includes("application/json") && request.method !== "GET") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, "INVALID_JSON");
    }
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      if (typeof record.key === "string") keys.push(record.key);
      if (Array.isArray(record.keys)) {
        for (const value of record.keys) {
          if (typeof value === "string") keys.push(value);
        }
      }
    }
  }

  const unique = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return errorResponse("Missing 'key' query parameter or JSON body", 400, "MISSING_KEY");
  }
  if (unique.length > MAX_DELETE_KEYS) {
    return errorResponse(
      `Too many keys (${unique.length}). Max is ${MAX_DELETE_KEYS}.`,
      400,
      "TOO_MANY_KEYS"
    );
  }

  for (const key of unique) {
    if (!sanitizeKey(key)) {
      return errorResponse(`Invalid key: ${key}`, 400, "INVALID_KEY");
    }
  }
  return unique;
}

/** DELETE /api/delete?key=... 或 DELETE /api/delete with {"keys": [...]} */
export async function handleDelete(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const auth = await requireAuth(request, env);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const keys = await parseDeleteKeys(request);
  if (keys instanceof Response) return keys;

  if (user.role !== "admin") {
    const allowedPrefix = `${await storagePrefix(user.username)}/`;
    const forbidden = keys.find((key) => !key.startsWith(allowedPrefix));
    if (forbidden) {
      return errorResponse("You can only delete your own images", 403, "FORBIDDEN");
    }
  }

  try {
    await env.IMAGES.delete(keys.length === 1 ? keys[0] : keys);
    // 一并删除对应的缩略图, 避免留下孤儿对象。
    const thumbs = keys.map(thumbKey);
    await env.IMAGES.delete(thumbs.length === 1 ? thumbs[0] : thumbs).catch(
      (err: unknown) => {
        console.error("R2 thumb delete failed", err);
      }
    );
    for (const key of keys) {
      purgeCache(ctx, request, env, key);
    }
    const response: DeleteResponse = {
      ok: true,
      deleted: keys,
      ...(keys.length === 1 ? { key: keys[0] } : {}),
    };
    return jsonResponse(response);
  } catch (err) {
    console.error("R2 delete failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`R2 delete failed: ${message}`, 500, "R2_ERROR");
  }
}

/**
 * 找出本页对象里已存在缩略图的 key。
 * 缩略图按原图目录归档, 每个目录列一次即可, 避免逐条 HEAD。
 * 并发与目录数都设上限, 防止管理员页面产生过多子请求。
 */
const THUMB_INDEX_CONCURRENCY = 6;
const THUMB_INDEX_MAX_DIRS = 24;

async function loadThumbIndex(env: Env, objects: R2Object[]): Promise<Set<string>> {
  const found = new Set<string>();
  const dirs = new Set<string>();
  for (const object of objects) {
    const slash = object.key.lastIndexOf("/");
    if (slash > 0) dirs.add(object.key.slice(0, slash));
    if (dirs.size >= THUMB_INDEX_MAX_DIRS) break;
  }

  const queue = [...dirs];
  async function worker(): Promise<void> {
    for (;;) {
      const dir = queue.shift();
      if (dir === undefined) return;
      try {
        const listed = await env.IMAGES.list({
          prefix: `${THUMB_PREFIX}${dir}/`,
          limit: 1000,
        });
        for (const thumb of listed.objects) {
          if (!thumb.key.endsWith(".thumb")) continue;
          found.add(thumb.key.slice(THUMB_PREFIX.length, -".thumb".length));
        }
      } catch (err) {
        console.error("R2 thumb list failed", err);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(THUMB_INDEX_CONCURRENCY, queue.length) }, () => worker())
  );
  return found;
}

/** GET /api/list?prefix=upload/file/&limit=100&cursor=... */
export async function handleList(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const url = new URL(request.url);
  // 管理员默认列出全部对象, 用户默认只列出自己目录。
  const ownPrefix = `${await storagePrefix(user.username)}/`;
  const defaultPrefix = user.role === "admin" ? "" : ownPrefix;
  const prefix = url.searchParams.get("prefix") ?? defaultPrefix;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const parsedLimit = limitParam === null ? 100 : Number.parseInt(limitParam, 10);

  if (sanitizePrefix(prefix) === null) {
    return errorResponse("Invalid prefix", 400, "INVALID_PREFIX");
  }
  if (user.role !== "admin") {
    const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    if (!normalizedPrefix.startsWith(ownPrefix)) {
      return errorResponse("You can only list your own images", 403, "FORBIDDEN");
    }
  }
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    return errorResponse("Limit must be between 1 and 1000", 400, "INVALID_LIMIT");
  }

  try {
    const result = await env.IMAGES.list({ prefix, cursor, limit: parsedLimit });
    // `.thumbs/` 下的缩略图对象不属于图库内容。
    const images = result.objects.filter((object) => !object.key.startsWith(THUMB_PREFIX));
    const thumbs = await loadThumbIndex(env, images);
    const response: ListResponse = {
      ok: true,
      count: images.length,
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : null,
      objects: images.map((object) => ({
        key: object.key,
        url: objectUrl(request, env, object.key),
        thumb: thumbUrl(request, env, object.key),
        hasThumb: thumbs.has(object.key),
        size: object.size,
        uploaded: object.uploaded.toISOString(),
        etag: object.httpEtag,
      })),
    };
    return jsonResponse(response);
  } catch (err) {
    console.error("R2 list failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`R2 list failed: ${message}`, 500, "R2_ERROR");
  }
}
