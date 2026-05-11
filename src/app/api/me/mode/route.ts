import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { wallet, mode } = await req.json();
  if (!wallet || !mode) return NextResponse.json({ error: "wallet and mode required" }, { status: 400 });
  if (mode !== "ARTIST" && mode !== "INVESTOR") return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  try {
    const u = await prisma.user.findUnique({ where: { wallet } });
    if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });
    if (mode === "ARTIST" && u.role !== "ARTIST" && u.role !== "ADMIN") {
      return NextResponse.json({ error: "Artist role not granted to this account" }, { status: 403 });
    }
    const updated = await prisma.user.update({ where: { id: u.id }, data: { preferredMode: mode } });
    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Mode update failed", error);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        databaseAvailable: false,
        user: {
          wallet,
          role: mode === "ARTIST" ? "ARTIST" : "INVESTOR",
          preferredMode: mode,
        },
      });
    }
    return NextResponse.json({ error: "Could not update account mode" }, { status: 503 });
  }
}
