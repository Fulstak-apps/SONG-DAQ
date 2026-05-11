const FALLBACK_SOL_USD = 150;
const CACHE_MS = 60_000;

let cached: { price: number; ts: number } | null = null;

export async function getSolUsdPrice(): Promise<number | null> {
  if (cached && Date.now() - cached.ts < CACHE_MS) return cached.price;
  try {
    const res = await fetch("/api/price/sol", { cache: "no-store" });
    if (!res.ok) throw new Error("SOL price unavailable");
    const json = await res.json();
    const price = Number(json.priceUsd ?? json.usd ?? json.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Bad SOL price");
    cached = { price, ts: Date.now() };
    return price;
  } catch {
    if (cached?.price) return cached.price;
    return null;
  }
}

export function convertSolToUsd(solAmount: number, solUsd = FALLBACK_SOL_USD) {
  return Number(solAmount || 0) * solUsd;
}

export function convertUsdToSol(usdAmount: number, solUsd = FALLBACK_SOL_USD) {
  return solUsd > 0 ? Number(usdAmount || 0) / solUsd : 0;
}

export function formatUsd(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "USD unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Math.abs(Number(value)) < 1 ? 4 : 2 }).format(Number(value));
}

export function formatSol(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "SOL unavailable";
  const n = Number(value);
  return `${n >= 1 ? n.toFixed(3) : n.toFixed(6)} SOL`;
}

export function formatSolWithUsd(solAmount: number | null | undefined, solUsd?: number | null) {
  const sol = Number(solAmount);
  if (!Number.isFinite(sol)) return "SOL unavailable";
  if (!solUsd) return `${formatSol(sol)} ≈ USD unavailable`;
  return `${formatSol(sol)} ≈ ${formatUsd(convertSolToUsd(sol, solUsd))}`;
}

export function formatUsdWithSol(usdAmount: number | null | undefined, solUsd?: number | null) {
  const usd = Number(usdAmount);
  if (!Number.isFinite(usd)) return "USD unavailable";
  if (!solUsd) return `${formatUsd(usd)} ≈ SOL unavailable`;
  return `${formatUsd(usd)} ≈ ${formatSol(convertUsdToSol(usd, solUsd))}`;
}
