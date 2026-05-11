import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

const REASONS = new Set([
  "IMPERSONATION",
  "STOLEN_SONG",
  "FAKE_ROYALTY",
  "SCAM",
  "OFFENSIVE",
  "MARKET_MANIPULATION",
  "WRONG_METADATA",
]);

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!verifyAdminSession(req)) {
    if (!wallet) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
    try {
      await requireAdmin(wallet);
    } catch {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }
  }
  const reports = await prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { song: true, reporter: true } });
  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "").toUpperCase();
  if (!REASONS.has(reason)) return NextResponse.json({ error: "valid reason required" }, { status: 400 });
  const reporter = body.wallet ? await prisma.user.findUnique({ where: { wallet: String(body.wallet) } }) : null;
  const report = await prisma.report.create({
    data: {
      reporterId: reporter?.id,
      songId: body.songId ? String(body.songId) : undefined,
      mint: body.mint ? String(body.mint) : undefined,
      reason,
      description: body.description ? String(body.description).slice(0, 2000) : undefined,
      email: body.email ? String(body.email).slice(0, 240) : undefined,
    },
  });
  if (body.songId) {
    await prisma.songToken.update({ where: { id: String(body.songId) }, data: { reportCount: { increment: 1 } } }).catch(() => {});
  }
  return NextResponse.json({ report });
}
