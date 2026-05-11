import { NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";

let cache: { priceUsd: number; ts: number } | null = null;
const CACHE_MS = 60_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_MS) {
    return NextResponse.json({ priceUsd: cache.priceUsd, cached: true });
  }

  try {
    const data = await fetchJson<any>(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      {},
      3500,
    );
    const priceUsd = Number(data?.solana?.usd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error("Bad SOL price response");
    cache = { priceUsd, ts: Date.now() };
    return NextResponse.json({ priceUsd, cached: false });
  } catch {
    if (cache?.priceUsd) return NextResponse.json({ priceUsd: cache.priceUsd, cached: true, stale: true });
    return NextResponse.json({ priceUsd: null, error: "USD unavailable" }, { status: 503 });
  }
}
