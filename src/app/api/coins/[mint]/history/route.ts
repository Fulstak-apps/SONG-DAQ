import { NextRequest, NextResponse } from "next/server";
import { getCandles, recordTick } from "@/lib/coinTicks";
import { getCoin } from "@/lib/audiusCoins";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { mint: string } },
) {
  const range = (req.nextUrl.searchParams.get("range") as any) ?? "1D";
  // Make sure the mint is seeded — first hit on a coin detail page might
  // beat the dashboard poller. Pull live data and record one tick.
  try {
    const c = await getCoin(params.mint);
    if (c) {
      recordTick(c.mint, c.price ?? 0, c.v24hUSD ?? 0, (c as any).history24hPrice ?? 0);
    }
  } catch { /* ignore — return whatever we have */ }
  const candles = getCandles(params.mint, range);
  return NextResponse.json({ candles });
}
