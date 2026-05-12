import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshSong } from "@/lib/refresh";
import { buildSongAssetState, getSongAssetRates } from "@/lib/assetState";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  await refreshSong(id).catch(() => undefined);
  const song = await prisma.songToken.findUnique({
    where: { id },
    include: {
      events: { where: { kind: "BURN" }, select: { kind: true, payload: true }, take: 100 },
    },
  });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
  const points = await prisma.pricePoint.findMany({
    where: { songId: id },
    orderBy: { ts: "asc" },
    take: 240,
  });
  const rates = await getSongAssetRates(song);
  const state = buildSongAssetState(song, rates);
  return NextResponse.json({
    price: state.priceSol || song.price,
    priceUsd: state.priceUsd,
    performance: song.performance,
    marketCap: state.marketValueSol || 0,
    marketCapUsd: state.marketValueUsd || 0,
    circulating: state.circulatingSupply || song.circulating,
    supply: song.supply,
    burnedSupply: state.burnedSupply,
    supplyDistribution: state.supplyDistribution,
    volume24h: song.volume24h,
    streams: song.streams,
    likes: song.likes,
    reposts: song.reposts,
    points,
  });
}
