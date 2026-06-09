import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const SCRYPT_PREFIX = "scrypt$";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionTokenPayload {
  id: string;
  email: string;
  fullName: string;
  sessionId: string;
  exp: number;
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters in production.",
    );
  }
  return "dev-insecure-session-secret-change-me";
}

export function assertProductionSecurityConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.trim().length < 32) {
    throw new Error(
      "Production startup blocked: set SESSION_SECRET (32+ chars) for the Express server.",
    );
  }

  const allowLegacyDb = process.env.ALLOW_LEGACY_FILE_DB === "1";
  const hasSupabaseServer =
    Boolean(process.env.SUPABASE_URL_PROD?.trim()) ||
    Boolean(process.env.SUPABASE_URL?.trim()) ||
    Boolean(process.env.VITE_SUPABASE_URL_PROD?.trim());

  if (allowLegacyDb && !hasSupabaseServer) {
    console.warn(
      "[security] ALLOW_LEGACY_FILE_DB=1 — file-db mode is for local development only. Use Supabase in production.",
    );
  }
}

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 64);
  return `${SCRYPT_PREFIX}${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (stored.startsWith(SCRYPT_PREFIX)) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = crypto.scryptSync(plain, salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  }

  const legacy = crypto.createHash("sha256").update(plain).digest("hex");
  if (legacy.length !== stored.length) return false;
  return crypto.timingSafeEqual(Buffer.from(legacy), Buffer.from(stored));
}

export function needsPasswordRehash(stored: string): boolean {
  return !stored.startsWith(SCRYPT_PREFIX);
}

export function createSessionToken(
  user: { id: string; email: string; fullName: string },
  sessionId: string,
): string {
  const payload: SessionTokenPayload = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    sessionId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const dot = token.indexOf(".");
  if (dot === -1) {
    return verifyLegacySessionToken(token);
  }

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  try {
    const expected = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionTokenPayload;
    if (!payload?.exp || payload.exp < Date.now()) return null;
    if (!payload.id || !payload.sessionId) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Accepts old unsigned base64 tokens during local dev migration only. */
function verifyLegacySessionToken(token: string): SessionTokenPayload | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString("utf-8")) as SessionTokenPayload;
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

export function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const entry = rateBuckets.get(key);

    if (!entry || now > entry.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (entry.count >= options.max) {
      res.status(429).json({ error: "Too many requests. Try again later." });
      return;
    }

    entry.count += 1;
    next();
  };
}

/** Safe Content-Disposition for uploaded images served from /uploads */
export function safeUploadHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
}
