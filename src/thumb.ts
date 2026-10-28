import type { Env } from "../worker-configuration";
import { requireAuth, storagePrefix } from "./auth";
import { IMAGE_CACHE_MAX_AGE, MAX_THUMB_SIZE, THUMB_CONTENT_TYPES } from "./lib/constants";
import { errorResponse, jsonResponse } from "./lib/http";
import { sanitizeKey, thumbKey, thumbUrl } from "./lib/keys";

/**
 * PUT /api/thumb?key=<原图 key>
 *
 * 由浏览器端 canvas 生成的缩略图, 一次性写入 `.thumbs/<key>.thumb`。
 * 图库列表改用缩略图后, 首屏不再下载原始大图。
 */
export async function handleThumbUpload(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return errorResponse("Missing 'key' query parameter", 400, "MISSING_KEY");
  }
  if (!sanitizeKey(key)) {
    return errorResponse("Invalid key", 400, "INVALID_KEY");
  }

  if (user.role !== "admin") {
    const allowedPrefix = `${await storagePrefix(user.username)}/`;
    if (!key.startsWith(allowedPrefix)) {
      return errorResponse(
        "You can only add thumbnails for your own images",
        403,
        "FORBIDDEN"
      );
    }
  }

  const contentType = (request.headers.get("Content-Type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!THUMB_CONTENT_TYPES.has(contentType)) {
    return errorResponse(
      `Unsupported thumbnail content type "${contentType}"`,
      400,
      "INVALID_CONTENT_TYPE"
    );
  }

  const declaredSize = Number.parseInt(request.headers.get("Content-Length") ?? "", 10);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_THUMB_SIZE) {
    return errorResponse(
      `Thumbnail too large (${declaredSize} bytes). Max is ${MAX_THUMB_SIZE} bytes.`,
      413,
      "THUMB_TOO_LARGE"
    );
  }

  let original: R2Object | null;
  try {
    original = await env.IMAGES.head(key);
  } catch (err) {
    console.error("R2 head failed", err);
    return errorResponse("Failed to read original image", 500, "R2_ERROR");
  }
  if (!original) {
    return errorResponse("Original image not found", 404, "NOT_FOUND");
  }

  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return errorResponse("Invalid request body", 400, "INVALID_REQUEST");
  }
  if (body.byteLength === 0) {
    return errorResponse("Request body is empty", 400, "EMPTY_BODY");
  }
  if (body.byteLength > MAX_THUMB_SIZE) {
    return errorResponse(
      `Thumbnail too large (${body.byteLength} bytes). Max is ${MAX_THUMB_SIZE} bytes.`,
      413,
      "THUMB_TOO_LARGE"
    );
  }
  if (body.byteLength >= original.size) {
    // 缩略图比原图还大没有意义, 拒绝写入。
    return errorResponse(
      "Thumbnail is not smaller than the original image",
      400,
      "THUMB_NOT_SMALLER"
    );
  }

  try {
    await env.IMAGES.put(thumbKey(key), body, {
      httpMetadata: {
        contentType,
        cacheControl: `public, max-age=${IMAGE_CACHE_MAX_AGE}, s-maxage=${IMAGE_CACHE_MAX_AGE}, immutable`,
      },
      customMetadata: {
        source: key.slice(0, 256),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("R2 thumb put failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`R2 upload failed: ${message}`, 500, "R2_ERROR");
  }

  return jsonResponse(
    {
      ok: true,
      key,
      thumb: thumbUrl(request, env, key),
      size: body.byteLength,
      contentType,
    },
    201
  );
}
