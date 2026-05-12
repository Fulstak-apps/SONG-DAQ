/**
 * Periodically refreshes a song's performance multiplier from Audius
 * metrics. Cached in Redis for 60s so concurrent requests don't hammer
 * discovery nodes.
 */

import { prisma } from "./db";
import { fetchMetrics } from "./audius";
import { computePerformance } from "./pricing";
import { spotPrice, marketCap } from "./bondingCurve";
import { cacheGet, cacheSet } from "./redis";
import { getAssetUsdRates, valueLocalSongCoin } from "./serverAssetPrices";

export async function refreshSong(songId: string, force = false): Promise<void> {
  const cacheKey = `song:refresh:${songId}`;
  if (!force) {
    const stamp = await cacheGet<number>(cacheKey);
    if (stamp) return;
  }
  const song = await prisma.songToken.findUnique({ where: { id: songId } });
  if (!song) return;
  let metrics: { streams: number; likes: number; reposts: number };
  try {
    metrics = await fetchMetrics(song.audiusTrackId);
  } catch {
    return; // discovery node unreachable — keep stale numbers
  }
  const hours = Math.max(
    1,
    (Date.now() - new Date(song.createdAt).getTime()) / 3_600_000,
  );
  const performance = computePerformance({
    streams: metrics.streams,
    prevStreams: song.streams,
    likes: metrics.likes,
    reposts: metrics.reposts,
    volume24h: song.volume24h,
    prevPerformance: song.performance,
    hoursSinceLaunch: hours,
  });
  const curvePrice = spotPrice({
    basePrice: song.basePrice,
    slope: song.curveSlope,
    circulating: song.circulating,
    performance,
  });
  const curveCap = marketCap({
    basePrice: song.basePrice,
    slope: song.curveSlope,
    circulating: song.circulating,
    performance,
  });
  const rates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", song.liquidityPairAsset]);
  const solUsd = Number(rates.SOL || 0);
  const valuation = valueLocalSongCoin({ ...(song as any), price: curvePrice }, rates);
  const price = valuation.priceSol > 0 ? valuation.priceSol : curvePrice;
  const cap = valuation.marketValueSol > 0 ? valuation.marketValueSol : curveCap;
  await prisma.songToken.update({
    where: { id: songId },
    data: {
      streams: metrics.streams,
      likes: metrics.likes,
      reposts: metrics.reposts,
      performance,
      price,
      marketCap: cap,
      currentPriceSol: price,
      currentPriceUsd: valuation.priceUsd > 0 ? valuation.priceUsd : solUsd > 0 ? price * solUsd : song.currentPriceUsd,
      marketCapUsd: valuation.marketValueUsd > 0 ? valuation.marketValueUsd : solUsd > 0 ? cap * solUsd : song.marketCapUsd,
    },
  });
  await cacheSet(cacheKey, Date.now(), 60);
}
