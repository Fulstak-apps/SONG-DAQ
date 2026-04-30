import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const song = await prisma.songToken.findUnique({ where: { id } });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
  const holdings = await prisma.holding.findMany({
    where: { songId: id },
    orderBy: { amount: "desc" },
    take: 20,
    include: { user: { select: { wallet: true, audiusHandle: true, audiusName: true, audiusAvatar: true } } },
  });
  const total = song.circulating || 1;
  const top = holdings.map((h) => ({
    wallet: h.user.wallet,
    audiusHandle: h.user.audiusHandle,
    audiusName: h.user.audiusName,
    audiusAvatar: h.user.audiusAvatar,
    amount: h.amount,
    pct: (h.amount / total) * 100,
    value: h.amount * song.price,
    costBasis: h.costBasis,
  }));
  return NextResponse.json({ holders: top, totalCirculating: song.circulating, totalSupply: song.supply });
}
