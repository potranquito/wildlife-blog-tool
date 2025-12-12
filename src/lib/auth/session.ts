import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "wb_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const TOKEN_VERSION = 1;

type SessionPayload = {
  v: number;
  iat: number;
  exp: number;
};

export function getAdminPassword() {
  return process.env.WILDLIFE_BLOGGER_ADMIN_PASSWORD?.trim() ?? "";
}

function getSessionSecret() {
  return process.env.WILDLIFE_BLOGGER_SESSION_SECRET?.trim() ?? "";
}

function base64urlEncodeUtf8(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64urlDecodeUtf8(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payloadB64: string) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Missing WILDLIFE_BLOGGER_SESSION_SECRET");
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createSessionToken(now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const exp = iat + SESSION_TTL_SECONDS;
  const payload: SessionPayload = { v: TOKEN_VERSION, iat, exp };
  const payloadB64 = base64urlEncodeUtf8(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function isValidSessionToken(token: string) {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return false;

    const expected = sign(payloadB64);
    if (sig.length !== expected.length) return false;

    const encoder = new TextEncoder();
    const ok = crypto.timingSafeEqual(encoder.encode(sig), encoder.encode(expected));
    if (!ok) return false;

    const parsed = JSON.parse(base64urlDecodeUtf8(payloadB64)) as SessionPayload;
    if (parsed.v !== TOKEN_VERSION) return false;
    if (typeof parsed.exp !== "number") return false;
    const now = Math.floor(Date.now() / 1000);
    if (now >= parsed.exp) return false;

    return true;
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/"
  };
}
