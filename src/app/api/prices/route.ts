import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";
const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";
const FIAT_CACHE_MS = 15 * 60_000;
let fiatCache: { at: number; currency: string; rate: number; source: string } | null = null;

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

async function usdToCurrencyRate(currency: string) {
  if (!currency || currency === "USD") return { rate: 1, source: "usd" };
  if (fiatCache && fiatCache.currency === currency && Date.now() - fiatCache.at < FIAT_CACHE_MS) {
    return { rate: fiatCache.rate, source: fiatCache.source };
  }
  try {
    const data = await fetchJson<{ rates?: Record<string, number> }>(
      `https://api.frankfurter.app/latest?from=USD&to=${encodeURIComponent(currency)}`,
      { next: { revalidate: 900 } },
      3_500,
    );
    const rate = Number(data?.rates?.[currency] ?? 0);
    if (rate > 0) {
      fiatCache = { at: Date.now(), currency, rate, source: "frankfurter" };
      return { rate, source: "frankfurter" };
    }
  } catch {}
  // If the display-currency feed fails, do not relabel USD as another
  // currency. Return an unavailable conversion so the UI can show
  // "Fiat estimate unavailable" without blocking the underlying action.
  return { rate: currency === "USD" ? 1 : 0, source: "unavailable" };
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
  const { rate: conversionRate, source: currencySource } = await usdToCurrencyRate(currency);
  const prices: Record<string, { usd: number | null; fiat: number | null; usdPrice: number | null; currency: string; source: string; estimated?: boolean }> = {};

  const setPrice = (key: string, usdPrice: number | null, source: string, estimated = false) => {
    const cleanUsd = usdPrice != null && Number.isFinite(Number(usdPrice)) && Number(usdPrice) > 0 ? Number(usdPrice) : null;
    const fiat = cleanUsd != null && conversionRate > 0 ? cleanUsd * conversionRate : null;
    prices[key] = {
      // Backward compatible: existing UI reads `.usd`, so store selected fiat here.
      usd: fiat,
      fiat,
      usdPrice: cleanUsd,
      currency,
      source: currency === "USD" ? source : `${source}+${currencySource}`,
      estimated,
    };
  };

  for (const id of normalized) {
    if (id.source === "stable") setPrice(id.key, 1, "stable");
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
        setPrice(id.key, usd > 0 ? usd : null, "jupiter");
      }
    } catch {
      for (const id of normalized) {
        if (id.source === "jupiter") setPrice(id.key, null, "unavailable");
      }
    }
  }

  if (prices.SOL?.usd == null || prices.SOL?.usdPrice == null) {
    const fallback = await solFallback();
    if (fallback) setPrice("SOL", fallback, "coingecko");
  }

  return NextResponse.json({
    currency,
    conversionRate,
    currencySource,
    prices,
    updatedAt: new Date().toISOString(),
  });
}
