import type { Env } from "../worker-configuration";
import { requireAuth, storagePrefix } from "./auth";
import {
  ALLOWED_EXTENSIONS,
  IMAGE_CACHE_MAX_AGE,
  MAX_MULTIPART_FILES,
  MAX_UPLOAD_SIZE,
} from "./lib/constants";
import { errorResponse, jsonResponse } from "./lib/http";
import type { UploadResponse } from "./lib/http";
import {
  defaultFilename,
  generateKey,
  isContentTypeAllowed,
  normalizeContentType,
  objectUrl,
  parseFilenameFromDisposition,
  validateFileExtension,
} from "./lib/keys";

const UPLOAD_OPTIONS = {
  cacheControl: `public, max-age=${IMAGE_CACHE_MAX_AGE}, s-maxage=${IMAGE_CACHE_MAX_AGE}, immutable`,
};

interface PreparedUpload {
  key: string;
  filename: string;
  contentType: string;
}

function tooLarge(size: number): Response {
  return errorResponse(
    `File too large (${size} bytes). Max is ${MAX_UPLOAD_SIZE} bytes.`,
    413,
    "FILE_TOO_LARGE"
  );
}

function invalidExtension(): Response {
  return errorResponse(
    `File extension not allowed. Allowed: ${Object.keys(ALLOWED_EXTENSIONS).join(", ")}`,
    400,
    "INVALID_EXTENSION"
  );
}

function invalidContentType(provided: string, ext: string): Response {
  return errorResponse(
    `Content-Type "${provided}" does not match extension "${ext}"`,
    400,
    "INVALID_CONTENT_TYPE"
  );
}

function contentLength(request: Request): number | null {
  const raw = request.headers.get("Content-Length");
  if (!raw) return null;
  const size = Number.parseInt(raw, 10);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

/** PUT /api/upload?filename=photo.jpg (请求体为原始二进制) */
export async function handleRawUpload(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const declaredSize = contentLength(request);
  if (declaredSize === null && request.headers.has("Content-Length")) {
    return errorResponse("Invalid Content-Length", 400, "INVALID_REQUEST");
  }
  if (declaredSize !== null && declaredSize <= 0) {
    return errorResponse("Request body is empty", 400, "EMPTY_BODY");
  }
  if (declaredSize !== null && declaredSize > MAX_UPLOAD_SIZE) {
    return tooLarge(declaredSize);
  }
  if (!request.body) {
    return errorResponse("Request body is empty", 400, "EMPTY_BODY");
  }

  const url = new URL(request.url);
  const rawFilename =
    url.searchParams.get("filename") ||
    request.headers.get("X-Filename") ||
    parseFilenameFromDisposition(request.headers.get("Content-Disposition")) ||
    defaultFilename(request.headers.get("Content-Type")) ||
    "upload";

  const validation = validateFileExtension(rawFilename);
  if (!validation) return invalidExtension();

  const requestContentType = request.headers.get("Content-Type");
  if (!isContentTypeAllowed(requestContentType, validation.mime)) {
    return invalidContentType(normalizeContentType(requestContentType) ?? "", validation.ext);
  }

  const key = generateKey(validation.ext, await storagePrefix(user.username));
  try {
    const object = await env.IMAGES.put(key, request.body, {
      httpMetadata: {
        contentType: validation.mime,
        cacheControl: UPLOAD_OPTIONS.cacheControl,
      },
      customMetadata: {
        owner: user.username.slice(0, 128),
        role: user.role,
        originalFilename: rawFilename.slice(0, 256),
        uploadedAt: new Date().toISOString(),
      },
    });

    if (object.size === 0) {
      await env.IMAGES.delete(object.key).catch(() => undefined);
      return errorResponse("Request body is empty", 400, "EMPTY_BODY");
    }

    const response: UploadResponse = {
      ok: true,
      key: object.key,
      url: objectUrl(request, env, object.key),
      size: object.size,
      contentType: validation.mime,
    };
    return jsonResponse(response, 201, { Location: response.url });
  } catch (err) {
    console.error("R2 put failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`R2 upload failed: ${message}`, 500, "R2_ERROR");
  }
}

/** POST /api/upload (multipart/form-data, 浏览器友好) */
export async function handleMultipartUpload(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const declaredSize = contentLength(request);
  if (declaredSize !== null && declaredSize > MAX_UPLOAD_SIZE + 1024 * 1024) {
    return tooLarge(declaredSize);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Invalid multipart/form-data body", 400, "INVALID_FORM_DATA");
  }

  const files = formData
    .getAll("file")
    .filter((value): value is File => typeof value === "object" && value !== null && "size" in value && "name" in value);

  if (files.length === 0) {
    return errorResponse("Missing 'file' in form data", 400, "MISSING_FILE");
  }
  if (files.length > MAX_MULTIPART_FILES) {
    return errorResponse(
      `Too many files (${files.length}). Max is ${MAX_MULTIPART_FILES}.`,
      400,
      "TOO_MANY_FILES"
    );
  }

  const filenameField = formData.get("filename");
  const filenameOverride = files.length === 1 && typeof filenameField === "string" ? filenameField : null;

  const prefix = await storagePrefix(user.username);
  const prepared: { file: File; upload: PreparedUpload }[] = [];
  for (const file of files) {
    if (file.size === 0) {
      return errorResponse(`File "${file.name || "upload"}" is empty`, 400, "EMPTY_BODY");
    }
    if (file.size > MAX_UPLOAD_SIZE) return tooLarge(file.size);

    const filename = filenameOverride?.trim() || file.name || "upload";
    const validation = validateFileExtension(filename);
    if (!validation) return invalidExtension();

    if (!isContentTypeAllowed(file.type, validation.mime)) {
      return invalidContentType(file.type, validation.ext);
    }

    prepared.push({
      file,
      upload: {
        key: generateKey(validation.ext, prefix),
        filename,
        contentType: validation.mime,
      },
    });
  }

  const uploaded: UploadResponse[] = [];
  try {
    for (const { file, upload } of prepared) {
      const object = await env.IMAGES.put(upload.key, await file.arrayBuffer(), {
        httpMetadata: {
          contentType: upload.contentType,
          cacheControl: UPLOAD_OPTIONS.cacheControl,
        },
        customMetadata: {
          owner: user.username.slice(0, 128),
          role: user.role,
          originalFilename: upload.filename.slice(0, 256),
          uploadedAt: new Date().toISOString(),
        },
      });

      uploaded.push({
        ok: true,
        key: object.key,
        url: objectUrl(request, env, object.key),
        size: object.size,
        contentType: upload.contentType,
      });
    }
  } catch (err) {
    // 批量上传失败时清理已经写入的对象, 避免留下孤儿文件。
    if (uploaded.length > 0) {
      await env.IMAGES.delete(uploaded.map((item) => item.key)).catch(() => undefined);
    }
    console.error("R2 multipart put failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`R2 upload failed: ${message}`, 500, "R2_ERROR");
  }

  if (uploaded.length === 1) {
    return jsonResponse(uploaded[0], 201, { Location: uploaded[0].url });
  }
  return jsonResponse({ ok: true, count: uploaded.length, files: uploaded }, 201);
}
