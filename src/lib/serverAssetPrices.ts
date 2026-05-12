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

export function normalizeAsset(asset: string | null | undefined) {
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
      // Static fallbacks keep fresh song-daq launches from displaying as
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
  const tokenAmount = Number(song.liquidityTokenAmount || 0);
  const pairAmount = Number(song.liquidityPairAmount || 0);
  const pairAsset = normalizeAsset(song.liquidityPairAsset || "SOL");
  const pairRate = pairAsset === "USDC" ? 1 : Number(rates[pairAsset] || FALLBACK_USD[pairAsset] || 0);
  if (tokenAmount > 0 && pairAmount > 0 && pairRate > 0) {
    return (pairAmount * pairRate) / tokenAmount;
  }

  const storedUsd = Number(song.currentPriceUsd || song.launchPriceUsd || 0);
  if (storedUsd > 0) return storedUsd;

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

export type SongCoinValuationBasis =
  | "active_market"
  | "liquidity_depth"
  | "thin_liquidity"
  | "pending_liquidity";

export function estimateSongLiquidityUsd(song: {
  launchLiquidityUsd?: number | null;
  liquidityPairAmount?: number | null;
  liquidityPairAsset?: string | null;
}, rates: Record<string, number> = {}) {
  const pairAmount = Number(song.liquidityPairAmount || 0);
  const pairAsset = normalizeAsset(song.liquidityPairAsset || "SOL");
  const pairRate = pairAsset === "USDC" ? 1 : Number(rates[pairAsset] || FALLBACK_USD[pairAsset] || 0);
  const implied = pairAmount > 0 && pairRate > 0 ? pairAmount * pairRate : 0;
  if (implied > 0) return implied;
  return Number(song.launchLiquidityUsd || 0);
}

export function valueLocalSongCoin(song: {
  currentPriceUsd?: number | null;
  launchPriceUsd?: number | null;
  currentPriceSol?: number | null;
  launchPriceSol?: number | null;
  price?: number | null;
  liquidityPairAmount?: number | null;
  liquidityTokenAmount?: number | null;
  liquidityPairAsset?: string | null;
  launchLiquidityUsd?: number | null;
  supply?: number | null;
  circulating?: number | null;
  volume24h?: number | null;
  status?: string | null;
}, rates: Record<string, number> = {}) {
  const priceUsd = estimateSongTokenUsd(song, rates);
  const priceSol = estimateSongTokenSol(song, rates);
  const liquidityUsd = estimateSongLiquidityUsd(song, rates);
  const totalSupply = Math.max(0, Number(song.supply || 0));
  const liquidityTokenAmount = Math.max(0, Number(song.liquidityTokenAmount || 0));
  const circulating = Math.max(0, Number(song.circulating || 0));
  const solRate = Number(rates.SOL || FALLBACK_USD.SOL || 0);
  const volumeUsd = Math.max(0, Number(song.volume24h || 0)) * (solRate > 0 ? solRate : 1);
  const tradableSupply = liquidityTokenAmount > 0
    ? Math.min(liquidityTokenAmount, totalSupply || liquidityTokenAmount)
    : circulating;
  const activeSupply = circulating > 0 ? circulating : tradableSupply;
  const hasLiquidity = liquidityUsd > 0 && liquidityTokenAmount > 0;
  const hasTrading = circulating > 0 || volumeUsd > 0;
  const basis: SongCoinValuationBasis = hasTrading
    ? "active_market"
    : hasLiquidity && liquidityUsd >= 10
      ? "liquidity_depth"
      : hasLiquidity
        ? "thin_liquidity"
        : "pending_liquidity";
  const marketSupply = hasTrading ? circulating : tradableSupply;
  const publicMarketValueUsd = priceUsd > 0 && marketSupply > 0 ? priceUsd * marketSupply : 0;
  const marketValueUsd = basis === "thin_liquidity" || basis === "pending_liquidity"
    ? 0
    : publicMarketValueUsd;
  const marketValueSol = priceSol > 0 && marketSupply > 0 && marketValueUsd > 0 ? priceSol * marketSupply : 0;
  const fullyDilutedValueUsd = priceUsd > 0 && totalSupply > 0 ? priceUsd * totalSupply : 0;

  return {
    priceUsd,
    priceSol,
    liquidityUsd,
    totalSupply,
    tradableSupply,
    circulatingSupply: activeSupply,
    marketValueUsd,
    marketValueSol,
    fullyDilutedValueUsd,
    volumeUsd,
    basis,
    isMarketValueReliable: basis === "active_market" || basis === "liquidity_depth",
    note: basis === "active_market"
      ? "Market value uses the active public trading supply."
      : basis === "liquidity_depth"
        ? "Market value uses the public liquidity supply, not the full 1B supply."
        : basis === "thin_liquidity"
          ? "Market value is hidden until there is enough liquidity or real trading activity."
          : "Market value appears after liquidity or real trades are available.",
  };
}
