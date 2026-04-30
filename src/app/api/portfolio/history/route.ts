import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCandles } from "@/lib/coinTicks";

export const dynamic = "force-dynamic";

/**
 * Synthesize a portfolio equity curve by summing each holding's value over
 * time. For coins we use the in-memory tick history (USD); for song IPOs we
 * approximate with current price × amount and a flat line at cost basis ago
 * (no historical prices stored on-chain in this dev build).
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const range = (req.nextUrl.searchParams.get("range") as any) ?? "1D";
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { wallet },
    include: { holdings: { include: { song: true } } },
  });
  if (!user) return NextResponse.json({ points: [] });

  const coinHoldings = await prisma.coinHolding.findMany({ where: { userId: user.id } });

  // Collect timestamps from any coin tick series we have.
  const buckets: Map<number, number> = new Map();
  for (const h of coinHoldings) {
    const candles = getCandles(h.mint, range);
    for (const c of candles) {
      const ts = new Date(c.ts).getTime();
      const bucket = Math.floor(ts / (60_000 * 5)) * (60_000 * 5); // 5min buckets
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + c.close * h.amount);
    }
  }

  // Add song-IPO contribution as a flat line equal to current value at every
  // bucket. Good enough until we record SongPriceTick.
  let songValue = 0;
  for (const h of user.holdings) songValue += h.amount * h.song.price;

  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  const points = sorted.map(([t, coinV]) => ({
    ts: new Date(t).toISOString(),
    open: coinV + songValue,
    high: coinV + songValue,
    low: coinV + songValue,
    close: coinV + songValue,
    volume: 0,
  }));
  // Always anchor at "now" so the chart shows the current portfolio value.
  let nowCoinValue = 0;
  for (const h of coinHoldings) {
    const c = getCandles(h.mint, "1H");
    const last = c[c.length - 1]?.close ?? h.costBasis;
    nowCoinValue += last * h.amount;
  }
  points.push({
    ts: new Date().toISOString(),
    open: nowCoinValue + songValue,
    high: nowCoinValue + songValue,
    low: nowCoinValue + songValue,
    close: nowCoinValue + songValue,
    volume: 0,
  });

  return NextResponse.json({ points });
}
