import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshSong } from "@/lib/refresh";
import { spotPrice } from "@/lib/bondingCurve";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  await refreshSong(id).catch(() => undefined);
  const song = await prisma.songToken.findUnique({ where: { id } });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
  const params = {
    basePrice: song.basePrice,
    slope: song.curveSlope,
    circulating: song.circulating,
    performance: song.performance,
  };
  const points = await prisma.pricePoint.findMany({
    where: { songId: id },
    orderBy: { ts: "asc" },
    take: 240,
  });
  return NextResponse.json({
    price: spotPrice(params),
    performance: song.performance,
    marketCap: song.marketCap,
    circulating: song.circulating,
    supply: song.supply,
    volume24h: song.volume24h,
    streams: song.streams,
    likes: song.likes,
    reposts: song.reposts,
    points,
  });
}
