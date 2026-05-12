import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshSong } from "@/lib/refresh";
import { getAssetUsdRates, valueLocalSongCoin } from "@/lib/serverAssetPrices";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  await refreshSong(id).catch(() => undefined);
  const song = await prisma.songToken.findUnique({ where: { id } });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
  const points = await prisma.pricePoint.findMany({
    where: { songId: id },
    orderBy: { ts: "asc" },
    take: 240,
  });
  const rates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", song.liquidityPairAsset]);
  const valuation = valueLocalSongCoin(song, rates);
  return NextResponse.json({
    price: valuation.priceSol || song.price,
    priceUsd: valuation.priceUsd,
    performance: song.performance,
    marketCap: valuation.marketValueSol || 0,
    marketCapUsd: valuation.marketValueUsd || 0,
    circulating: valuation.circulatingSupply || song.circulating,
    supply: song.supply,
    volume24h: song.volume24h,
    streams: song.streams,
    likes: song.likes,
    reposts: song.reposts,
    points,
  });
}
