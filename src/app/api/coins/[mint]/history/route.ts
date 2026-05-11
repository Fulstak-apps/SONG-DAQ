import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCandles, recordTick, type CoinRange } from "@/lib/coinTicks";
import { getCoin } from "@/lib/audiusCoins";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { mint: string } },
) {
  const range = (req.nextUrl.searchParams.get("range") as CoinRange | null) ?? "LIVE";
  // Make sure the mint is seeded — first hit on a coin detail page might
  // beat the dashboard poller. Pull live data and record one tick.
  try {
    const c = await getCoin(params.mint);
    if (c) {
      recordTick(c.mint, c.price ?? 0, c.v24hUSD ?? 0, (c as any).history24hPrice ?? 0);
    }
  } catch { /* ignore — return whatever we have */ }
  const candles = getCandles(params.mint, range);
  let trades: Array<{
    id: string;
    side: "BUY" | "SELL";
    amount: number;
    priceUsd: number;
    totalUsd: number;
    txSig: string | null;
    createdAt: Date;
    user: { wallet: string | null };
    ticker: string;
  }> = [];
  try {
    trades = await prisma.coinTrade.findMany({
      where: { mint: params.mint },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        user: { select: { wallet: true } },
      },
    }) as any;
  } catch {
    trades = [];
  }
  return NextResponse.json({ candles, trades: trades.map((trade) => ({
    id: trade.id,
    side: trade.side,
    amount: trade.amount,
    priceUsd: trade.priceUsd,
    totalUsd: trade.totalUsd,
    txSig: trade.txSig,
    createdAt: trade.createdAt.toISOString(),
    wallet: trade.user.wallet,
    ticker: trade.ticker,
  })) });
}
