import { fetchJson } from "@/lib/fetchTimeout";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";
const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";
const CACHE_MS = 45_000;

const FALLBACK_USD: Record<string, number> = {
  SOL: 150,
  AUDIO: 0.18,
  USDC: 1,
};

let cached: { at: number; prices: Record<string, number> } | null = null;

function normalizeAsset(asset: string | null | undefined) {
  const upper = String(asset || "").trim().replace(/^\$/, "").toUpperCase();
  if (upper === "SOL") return "SOL";
  if (upper === "AUDIO") return "AUDIO";
  if (upper === "USDC") return "USDC";
  return upper;
}

function mintForAsset(asset: string) {
  if (asset === "SOL") return SOL_MINT;
  if (asset === "AUDIO") return AUDIO_MINT;
  return asset;
}

export async function getAssetUsdRates(assets: Array<string | null | undefined>) {
  const normalized = Array.from(new Set(assets.map(normalizeAsset).filter(Boolean)));
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS && normalized.every((asset) => cached?.prices[asset] != null)) {
    return Object.fromEntries(normalized.map((asset) => [asset, cached!.prices[asset]]));
  }

  const prices: Record<string, number> = {};
  for (const asset of normalized) {
    if (asset === "USDC") prices[asset] = 1;
  }

  const jupiterAssets = normalized.filter((asset) => asset !== "USDC");
  if (jupiterAssets.length) {
    try {
      const query = jupiterAssets.map(mintForAsset).join(",");
      const data = await fetchJson<Record<string, { usdPrice?: number; price?: number }>>(
        `${JUPITER_PRICE_API}?ids=${query}`,
        { next: { revalidate: 30 } },
        3_500,
      );
      for (const asset of jupiterAssets) {
        const raw = data?.[mintForAsset(asset)];
        const usd = Number(raw?.usdPrice ?? raw?.price ?? 0);
        if (usd > 0) prices[asset] = usd;
      }
    } catch {
      // Static fallbacks keep fresh SONG·DAQ launches from displaying as
      // price-less while external price APIs or Render are slow.
    }
  }

  for (const asset of normalized) {
    if (!(prices[asset] > 0) && FALLBACK_USD[asset] > 0) prices[asset] = FALLBACK_USD[asset];
  }

  cached = { at: now, prices: { ...(cached?.prices ?? {}), ...prices } };
  return Object.fromEntries(normalized.map((asset) => [asset, prices[asset] ?? 0]));
}

export function estimateSongTokenUsd(song: {
  currentPriceUsd?: number | null;
  launchPriceUsd?: number | null;
  liquidityPairAmount?: number | null;
  liquidityTokenAmount?: number | null;
  liquidityPairAsset?: string | null;
  currentPriceSol?: number | null;
  launchPriceSol?: number | null;
  price?: number | null;
}, rates: Record<string, number> = {}) {
  const storedUsd = Number(song.currentPriceUsd || song.launchPriceUsd || 0);
  if (storedUsd > 0) return storedUsd;

  const tokenAmount = Number(song.liquidityTokenAmount || 0);
  const pairAmount = Number(song.liquidityPairAmount || 0);
  const pairAsset = normalizeAsset(song.liquidityPairAsset || "SOL");
  const pairRate = pairAsset === "USDC" ? 1 : Number(rates[pairAsset] || FALLBACK_USD[pairAsset] || 0);
  if (tokenAmount > 0 && pairAmount > 0 && pairRate > 0) {
    return (pairAmount * pairRate) / tokenAmount;
  }

  const solPrice = Number(song.currentPriceSol || song.launchPriceSol || song.price || 0);
  const solRate = Number(rates.SOL || FALLBACK_USD.SOL || 0);
  return solPrice > 0 && solRate > 0 ? solPrice * solRate : 0;
}

export function estimateSongTokenSol(song: {
  currentPriceSol?: number | null;
  launchPriceSol?: number | null;
  price?: number | null;
  liquidityPairAmount?: number | null;
  liquidityTokenAmount?: number | null;
  liquidityPairAsset?: string | null;
}, rates: Record<string, number> = {}) {
  const storedSol = Number(song.currentPriceSol || song.launchPriceSol || song.price || 0);
  if (storedSol > 0) return storedSol;
  const usd = estimateSongTokenUsd(song, rates);
  const solRate = Number(rates.SOL || FALLBACK_USD.SOL || 0);
  return usd > 0 && solRate > 0 ? usd / solRate : 0;
}
