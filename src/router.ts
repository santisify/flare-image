import type { Env } from "../worker-configuration";
import { handleLogin, handleLogout, handleMe } from "./auth";
import { handleDownload } from "./download";
import { handleDelete, handleList } from "./gallery";
import { ALLOWED_EXTENSIONS, MAX_MULTIPART_FILES, MAX_UPLOAD_SIZE } from "./lib/constants";
import {
  corsPreflightResponse,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
} from "./lib/http";
import { handleMultipartUpload, handleRawUpload } from "./upload";
import { DASHBOARD_HTML } from "./ui";

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
    version: "1.6.0",
    auth: {
      login: "POST /api/login {username,password}",
      logout: "POST /api/logout",
      me: "GET /api/me",
      apiClients: "HTTP Basic Auth (curl -u username:password)",
    },
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

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  try {
    if (method === "OPTIONS") {
      return corsPreflightResponse();
    }

    if (
      (url.pathname === "/" || url.pathname === "/dashboard") &&
      (method === "GET" || method === "HEAD")
    ) {
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

    if (url.pathname === "/api/login") {
      if (method === "POST") return await handleLogin(request, env);
      return methodNotAllowed("POST, OPTIONS");
    }

    if (url.pathname === "/api/logout") {
      if (method === "POST") return handleLogout(request);
      return methodNotAllowed("POST, OPTIONS");
    }

    if (url.pathname === "/api/me") {
      if (method === "GET") return await handleMe(request, env);
      return methodNotAllowed("GET, OPTIONS");
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
}
