import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { maybePromoteToArtist, syncConfiguredAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ user: null });
  try {
    const configuredAdmin = await syncConfiguredAdmin(wallet);
    const u = configuredAdmin || await prisma.user.findUnique({ where: { wallet } });
    if (!u) return NextResponse.json({ user: null });
    // refresh role if the user just linked Audius; env-admin wallets stay admin.
    if (configuredAdmin) {
      return NextResponse.json({ user: configuredAdmin });
    }
    await maybePromoteToArtist(u.id);
    const fresh = await prisma.user.findUnique({ where: { wallet } });
    return NextResponse.json({ user: fresh });
  } catch {
    return NextResponse.json({ user: null, databaseAvailable: false });
  }
}
