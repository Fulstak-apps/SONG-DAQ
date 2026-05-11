import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshSong } from "@/lib/refresh";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  await refreshSong(id).catch(() => undefined);
  const song = await prisma.songToken.findFirst({
    where: { OR: [{ id }, { symbol: id.toUpperCase() }, { audiusTrackId: id }] },
    include: {
      artistWallet: { select: { wallet: true, handle: true, audiusHandle: true, audiusName: true, audiusVerified: true } },
      pricePoints: { orderBy: { ts: "desc" }, take: 240 },
      trades: { orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { wallet: true } } } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ song });
}
