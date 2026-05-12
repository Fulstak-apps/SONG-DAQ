import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshSong } from "@/lib/refresh";
import { getTrack } from "@/lib/audius";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getAssetUsdRates, valueLocalSongCoin } from "@/lib/serverAssetPrices";

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
  const durationKey = `song:duration:${song.audiusTrackId}`;
  let duration = await cacheGet<number>(durationKey).catch(() => null);
  if (!duration) {
    const track = await getTrack(song.audiusTrackId).catch(() => null);
    duration = Number(track?.duration || 0);
    if (duration > 0) await cacheSet(durationKey, duration, 60 * 60 * 24).catch(() => {});
  }
  const rates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", song.liquidityPairAsset]);
  const valuation = valueLocalSongCoin(song, rates);
  return NextResponse.json({
    song: {
      ...song,
      duration: duration || null,
      price: valuation.priceSol || song.price,
      currentPriceSol: valuation.priceSol || song.currentPriceSol,
      currentPriceUsd: valuation.priceUsd || song.currentPriceUsd,
      marketCap: valuation.marketValueSol || 0,
      marketCapUsd: valuation.marketValueUsd || 0,
      launchLiquidityUsd: valuation.liquidityUsd || song.launchLiquidityUsd,
      circulating: valuation.circulatingSupply || song.circulating,
      tradableSupply: valuation.tradableSupply,
      fullyDilutedValueUsd: valuation.fullyDilutedValueUsd,
      marketValueBasis: valuation.basis,
      marketValueNote: valuation.note,
      isMarketValueReliable: valuation.isMarketValueReliable,
    },
  });
}
