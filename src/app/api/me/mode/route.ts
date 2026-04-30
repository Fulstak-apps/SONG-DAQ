import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { wallet, mode } = await req.json();
  if (!wallet || !mode) return NextResponse.json({ error: "wallet and mode required" }, { status: 400 });
  if (mode !== "ARTIST" && mode !== "INVESTOR") return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  const u = await prisma.user.findUnique({ where: { wallet } });
  if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (mode === "ARTIST" && u.role !== "ARTIST") {
    return NextResponse.json({ error: "Artist role not granted to this account" }, { status: 403 });
  }
  const updated = await prisma.user.update({ where: { id: u.id }, data: { preferredMode: mode } });
  return NextResponse.json({ user: updated });
}
