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
    /** 缩略图 URL (`?thumb=1`), 没有缩略图时回退到原图 */
    thumb: string;
    /** 是否已存在缩略图, 前端据此决定是否补生成 */
    hasThumb: boolean;
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

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "ETag, Content-Length, Content-Range, Accept-Ranges",
};

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

export function notFoundResponse(): Response {
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
