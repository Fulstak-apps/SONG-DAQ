import { NextRequest, NextResponse } from "next/server";
import {
  adminCookieMaxAge,
  adminCookieName,
  adminPasswordLoginEnabled,
  createAdminSession,
  verifyAdminSession,
} from "@/lib/adminSession";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    authenticated: verifyAdminSession(req),
    passwordLoginEnabled: adminPasswordLoginEnabled(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "");
  const password = String(body.password || "");
  if (!adminPasswordLoginEnabled()) {
    return NextResponse.json({ error: "Admin password login is not configured" }, { status: 503 });
  }
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid admin login" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(), createAdminSession(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: adminCookieMaxAge(),
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
