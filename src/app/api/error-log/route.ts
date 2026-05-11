import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appMode } from "@/lib/appMode";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "Unknown client error").slice(0, 1000);
  const stack = body.stack ? String(body.stack).slice(0, 5000) : undefined;
  const page = body.page ? String(body.page).slice(0, 500) : undefined;
  const walletAddress = body.walletAddress ? String(body.walletAddress).slice(0, 100) : undefined;
  const errorType = String(body.errorType || "client").slice(0, 80);

  try {
    await prisma.errorLog.create({
      data: {
        mode: appMode(),
        errorType,
        walletAddress,
        page,
        message,
        stack,
      },
    });
  } catch {
    return NextResponse.json({ ok: true, persisted: false });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
