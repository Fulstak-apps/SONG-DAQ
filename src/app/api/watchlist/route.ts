import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ items: [] });
  const u = await prisma.user.findUnique({ where: { wallet } });
  if (!u) return NextResponse.json({ items: [] });
  const items = await prisma.watch.findMany({
    where: { userId: u.id },
    include: { song: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const { wallet, songId, action = "toggle" } = await req.json();
  if (!wallet || !songId) return NextResponse.json({ error: "wallet and songId required" }, { status: 400 });
  const u = await prisma.user.findUnique({ where: { wallet } });
  if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const exists = await prisma.watch.findUnique({ where: { userId_songId: { userId: u.id, songId } } });
  if (action === "remove" || (action === "toggle" && exists)) {
    if (exists) await prisma.watch.delete({ where: { id: exists.id } });
    return NextResponse.json({ ok: true, watching: false });
  }
  if (!exists) {
    await prisma.watch.create({ data: { userId: u.id, songId } });
  }
  return NextResponse.json({ ok: true, watching: true });
}
