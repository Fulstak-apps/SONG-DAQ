import { NextRequest, NextResponse } from "next/server";
import { listCoins, hydrateArtists } from "@/lib/audiusCoins";
import { recordTick, getTicks } from "@/lib/coinTicks";
import { calculateCoinRisk } from "@/lib/risk/calculateCoinRisk";

export const dynamic = "force-dynamic";

function timeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(id));
  });
}

export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") ?? "marketCap";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 60);
  try {
    const coins = await timeout(listCoins(limit), 3_000, []);
    const raw = coins.slice(0, limit);
    const enriched = raw.length ? await timeout(hydrateArtists(raw), 4_800, raw) : [];
    for (const c of enriched) {
      recordTick(c.mint, c.price ?? 0, c.v24hUSD ?? 0, (c as any).history24hPrice ?? 0);
    }
    const sorted = [...enriched].sort((a, b) => {
      const qualityA = calculateCoinRisk(a as any).score * 1000 + Number(a.liquidity ?? 0) * 0.25 + Number(a.holder ?? 0) * 4 + Number(a.v24hUSD ?? 0) * 0.002;
      const qualityB = calculateCoinRisk(b as any).score * 1000 + Number(b.liquidity ?? 0) * 0.25 + Number(b.holder ?? 0) * 4 + Number(b.v24hUSD ?? 0) * 0.002;
      switch (sort) {
        case "volume": return (b.v24h ?? 0) - (a.v24h ?? 0);
        case "gainers": return (b.priceChange24hPercent ?? 0) - (a.priceChange24hPercent ?? 0);
        case "holders": return (b.holder ?? 0) - (a.holder ?? 0);
        case "price": return (b.price ?? 0) - (a.price ?? 0);
        case "marketCap": return (b.marketCap ?? 0) - (a.marketCap ?? 0);
        default: return qualityB - qualityA;
      }
    });
    // Down-sample the rolling tick store to ~32 points per coin so every
    // card can render a sparkline without firing a separate request.
    const withSparks = sorted.map((c) => {
      const ticks = getTicks(c.mint);
      const N = 32;
      const stride = Math.max(1, Math.floor(ticks.length / N));
      const sparkline: number[] = [];
      for (let i = 0; i < ticks.length; i += stride) sparkline.push(ticks[i].p);
      if (ticks.length && sparkline[sparkline.length - 1] !== ticks[ticks.length - 1].p) {
        sparkline.push(ticks[ticks.length - 1].p);
      }
      return { ...c, sparkline };
    });
    return NextResponse.json({ coins: withSparks });
  } catch (e: any) {
    return NextResponse.json({ coins: [], error: e.message }, { status: 200 });
  }
}
