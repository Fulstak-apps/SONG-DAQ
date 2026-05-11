import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const COOKIE = "songdaq_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function adminCookieName() {
  return COOKIE;
}

export function adminCookieMaxAge() {
  return MAX_AGE_SECONDS;
}

export function createAdminSession(username: string) {
  if (!secret()) throw new Error("ADMIN_SESSION_SECRET is required");
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + MAX_AGE_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || !secret()) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded?.u === process.env.ADMIN_USERNAME && Number(decoded?.exp ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export function adminPasswordLoginEnabled() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && secret());
}
