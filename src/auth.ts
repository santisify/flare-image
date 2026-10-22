import type { Env } from "../worker-configuration";
import { errorResponse, jsonResponse } from "./lib/http";

export type Role = "admin" | "user";

export interface AuthUser {
  username: string;
  role: Role;
}

interface Account extends AuthUser {
  password: string;
}

interface SessionPayload {
  sub: string;
  role: Role;
  exp: number;
}

type AuthResult = { user: AuthUser } | { response: Response };

const SESSION_COOKIE = "flare_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_VERSION = "flare-image-session-v1";

function getAccounts(env: Env): Account[] {
  const accounts: Account[] = [];

  const adminUsername = env.ADMIN_USERNAME?.trim();
  if (adminUsername && env.ADMIN_PASSWORD) {
    accounts.push({
      username: adminUsername,
      password: env.ADMIN_PASSWORD,
      role: "admin",
    });
  }

  const userUsername = env.USER_USERNAME?.trim();
  if (userUsername && env.USER_PASSWORD) {
    accounts.push({
      username: userUsername,
      password: env.USER_PASSWORD,
      role: "user",
    });
  }

  return accounts;
}

export function isAuthConfigured(env: Env): boolean {
  return getAccounts(env).length > 0;
}

/**
 * 用户名不直接进入 R2 key, 而是取用户名 SHA-256 的前 32 位十六进制。
 * 同一个用户名始终得到同一个目录, 路径中不会暴露用户名。
 */
async function storageHash(username: string): Promise<string> {
  const normalized = username.trim();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** 每个用户独立目录, 不再按日期分层: upload/file/<username-hash>/<id>.<ext> */
export async function storagePrefix(username: string): Promise<string> {
  return `upload/file/${await storageHash(username)}`;
}

// ─── 密码登录 ───────────────────────────────────────────────────

/** 对 SHA-256 摘要做定长比较, 避免密码 / 签名比较泄露时序信息。 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

async function findAccount(env: Env, username: string, password: string): Promise<Account | null> {
  for (const account of getAccounts(env)) {
    const usernameMatches = await timingSafeEqual(username, account.username);
    const passwordMatches = await timingSafeEqual(password, account.password);
    if (usernameMatches && passwordMatches) return account;
  }
  return null;
}

function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header) return null;
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return null;

  try {
    const binary = atob(match[1].trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

// ─── 会话签名 ───────────────────────────────────────────────────

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sessionKey(env: Env): Promise<CryptoKey> {
  const material = [
    SESSION_VERSION,
    env.SESSION_SECRET ?? "",
    env.ADMIN_USERNAME ?? "",
    env.ADMIN_PASSWORD ?? "",
    env.USER_USERNAME ?? "",
    env.USER_PASSWORD ?? "",
  ].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function sign(value: string, env: Env): Promise<string> {
  const key = await sessionKey(env);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function createSession(env: Env, account: Account): Promise<string> {
  const payload: SessionPayload = {
    sub: account.username,
    role: account.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(body, env);
  return `${body}.${signature}`;
}

async function verifySession(env: Env, token: string, accounts: Account[]): Promise<AuthUser | null> {
  const separator = token.indexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = await sign(body, env);
  if (!(await timingSafeEqual(signature, expected))) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (typeof record.sub !== "string" || typeof record.exp !== "number") return null;
  if (record.role !== "admin" && record.role !== "user") return null;
  if (record.exp <= Math.floor(Date.now() / 1000)) return null;

  const account = accounts.find(
    (candidate) => candidate.username === record.sub && candidate.role === record.role
  );
  if (!account) return null;
  return { username: account.username, role: account.role };
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    if (trimmed.slice(0, separator) === name) {
      return trimmed.slice(separator + 1) || null;
    }
  }
  return null;
}

function sessionCookie(request: Request, value: string, maxAge = SESSION_TTL_SECONDS): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// ─── 请求鉴权 ───────────────────────────────────────────────────

export async function authenticateRequest(request: Request, env: Env): Promise<AuthUser | null> {
  const accounts = getAccounts(env);
  if (accounts.length === 0) return null;

  const session = getCookie(request, SESSION_COOKIE);
  if (session) {
    const user = await verifySession(env, session, accounts);
    if (user) return user;
  }

  // API 客户端可以直接用 Basic Auth: curl -u user:password
  const basic = parseBasicAuth(request.headers.get("Authorization"));
  if (basic) {
    const account = await findAccount(env, basic.username, basic.password);
    if (account) return { username: account.username, role: account.role };
  }

  return null;
}

export async function requireAuth(request: Request, env: Env): Promise<AuthResult> {
  if (!isAuthConfigured(env)) {
    return {
      response: errorResponse(
        "Authentication is not configured. Set ADMIN_USERNAME/ADMIN_PASSWORD or USER_USERNAME/USER_PASSWORD.",
        500,
        "AUTH_NOT_CONFIGURED"
      ),
    };
  }

  const user = await authenticateRequest(request, env);
  if (!user) {
    return { response: errorResponse("Unauthorized", 401, "UNAUTHORIZED") };
  }
  return { user };
}

export async function requireAdmin(request: Request, env: Env): Promise<AuthResult> {
  const result = await requireAuth(request, env);
  if ("response" in result) return result;
  if (result.user.role !== "admin") {
    return { response: errorResponse("Admin privileges required", 403, "FORBIDDEN") };
  }
  return result;
}

// ─── 登录 / 登出 / 当前用户 ────────────────────────────────────

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!isAuthConfigured(env)) {
    return errorResponse(
      "Authentication is not configured. Set ADMIN_USERNAME/ADMIN_PASSWORD or USER_USERNAME/USER_PASSWORD.",
      500,
      "AUTH_NOT_CONFIGURED"
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_JSON");
  }
  if (!body || typeof body !== "object") {
    return errorResponse("Missing username or password", 400, "MISSING_CREDENTIALS");
  }

  const record = body as Record<string, unknown>;
  const username = record.username;
  const password = record.password;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return errorResponse("Missing username or password", 400, "MISSING_CREDENTIALS");
  }
  if (username.length > 128 || password.length > 256) {
    return errorResponse("Invalid username or password", 401, "INVALID_CREDENTIALS");
  }

  const account = await findAccount(env, username, password);
  if (!account) {
    return errorResponse("Invalid username or password", 401, "INVALID_CREDENTIALS");
  }

  const token = await createSession(env, account);
  return jsonResponse(
    {
      ok: true,
      user: { username: account.username, role: account.role },
    },
    200,
    { "Set-Cookie": sessionCookie(request, token) }
  );
}

export function handleLogout(request: Request): Response {
  return jsonResponse(
    { ok: true },
    200,
    { "Set-Cookie": sessionCookie(request, "", 0) }
  );
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if ("response" in auth) return auth.response;
  return jsonResponse({ ok: true, user: auth.user });
}
