import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";
const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";

function normalizeId(id: string) {
  const clean = id.trim();
  const upper = clean.toUpperCase();
  if (upper === "SOL") return { key: "SOL", query: SOL_MINT, source: "jupiter" };
  if (upper === "AUDIO" || upper === "$AUDIO") return { key: "AUDIO", query: AUDIO_MINT, source: "jupiter" };
  if (upper === "USDC") return { key: "USDC", query: "USDC", source: "stable" };
  return { key: clean, query: clean, source: "jupiter" };
}

async function solFallback() {
  try {
    const data = await fetchJson<{ solana?: { usd?: number } }>(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } },
      3_500,
    );
    const usd = Number(data?.solana?.usd ?? 0);
    return usd > 0 ? usd : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const currency = String(req.nextUrl.searchParams.get("currency") || "USD").toUpperCase();
  const requested = String(req.nextUrl.searchParams.get("ids") || "SOL,AUDIO")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 40);
  const normalized = requested.map(normalizeId);
  const queryIds = Array.from(new Set(normalized.filter((id) => id.source === "jupiter").map((id) => id.query)));
  const prices: Record<string, { usd: number | null; source: string }> = {};

  for (const id of normalized) {
    if (id.source === "stable") prices[id.key] = { usd: 1, source: "stable" };
  }

  if (queryIds.length) {
    try {
      const data = await fetchJson<Record<string, { usdPrice?: number; price?: number }>>(
        `${JUPITER_PRICE_API}?ids=${queryIds.join(",")}`,
        { next: { revalidate: 30 } },
        4_000,
      );
      for (const id of normalized) {
        if (id.source !== "jupiter") continue;
        const raw = data?.[id.query];
        const usd = Number(raw?.usdPrice ?? raw?.price ?? 0);
        prices[id.key] = { usd: usd > 0 ? usd : null, source: "jupiter" };
      }
    } catch {
      for (const id of normalized) {
        if (id.source === "jupiter") prices[id.key] = { usd: null, source: "unavailable" };
      }
    }
  }

  if (prices.SOL?.usd == null) {
    const fallback = await solFallback();
    if (fallback) prices.SOL = { usd: fallback, source: "coingecko" };
  }

  return NextResponse.json({
    currency,
    prices,
    updatedAt: new Date().toISOString(),
  });
}
