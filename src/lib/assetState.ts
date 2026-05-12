import { prisma } from "@/lib/db";
import { getAssetUsdRates, valueLocalSongCoin, type SongCoinValuationBasis } from "@/lib/serverAssetPrices";
import { calculateSupplyDistribution, getBurnedSupplyFromEvents, type SupplyDistribution } from "@/lib/supplyDistribution";

type SongLike = {
  id?: string;
  price?: number | null;
  currentPriceSol?: number | null;
  currentPriceUsd?: number | null;
  launchPriceSol?: number | null;
  launchPriceUsd?: number | null;
  liquidityPairAmount?: number | null;
  liquidityTokenAmount?: number | null;
  liquidityPairAsset?: string | null;
  launchLiquidityUsd?: number | null;
  supply?: number | null;
  circulating?: number | null;
  volume24h?: number | null;
  holder?: number | null;
  trade24h?: number | null;
  uniqueWallet24h?: number | null;
  status?: string | null;
  artistAllocationBps?: number | null;
  events?: Array<{ kind?: string | null; payload?: unknown }> | null;
};

export type SongAssetState = {
  priceSol: number;
  priceUsd: number;
  liquidityUsd: number;
  totalSupply: number;
  tradableSupply: number;
  circulatingSupply: number;
  marketValueSol: number;
  marketValueUsd: number;
  fullyDilutedValueUsd: number;
  volumeUsd: number;
  marketValueBasis: SongCoinValuationBasis;
  marketValueNote: string;
  isMarketValueReliable: boolean;
  burnedSupply: number;
  supplyDistribution: SupplyDistribution;
};

function positive(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function getSongAssetRates(song: SongLike) {
  return getAssetUsdRates(["SOL", "AUDIO", "USDC", song.liquidityPairAsset]);
}

export function buildSongAssetState(song: SongLike, rates: Record<string, number> = {}): SongAssetState {
  const valuation = valueLocalSongCoin(song, rates);
  const burnedSupply = getBurnedSupplyFromEvents(song.events);
  const supplyDistribution = calculateSupplyDistribution({
    supply: valuation.totalSupply || song.supply,
    circulating: valuation.circulatingSupply || song.circulating,
    liquidityTokenAmount: valuation.tradableSupply || song.liquidityTokenAmount,
    artistAllocationBps: song.artistAllocationBps,
    burnedSupply,
  });

  return {
    priceSol: positive(valuation.priceSol) || positive(song.price),
    priceUsd: positive(valuation.priceUsd) || positive(song.currentPriceUsd) || positive(song.launchPriceUsd),
    liquidityUsd: positive(valuation.liquidityUsd) || positive(song.launchLiquidityUsd),
    totalSupply: valuation.totalSupply,
    tradableSupply: valuation.tradableSupply,
    circulatingSupply: valuation.circulatingSupply,
    marketValueSol: valuation.marketValueSol,
    marketValueUsd: valuation.marketValueUsd,
    fullyDilutedValueUsd: valuation.fullyDilutedValueUsd,
    volumeUsd: valuation.volumeUsd,
    marketValueBasis: valuation.basis,
    marketValueNote: valuation.note,
    isMarketValueReliable: valuation.isMarketValueReliable,
    burnedSupply,
    supplyDistribution,
  };
}

export function songAssetReadFields(state: SongAssetState, fallback: SongLike = {}) {
  return {
    price: state.priceSol || fallback.price,
    currentPriceSol: state.priceSol || fallback.currentPriceSol,
    currentPriceUsd: state.priceUsd || fallback.currentPriceUsd,
    marketCap: state.marketValueSol || 0,
    marketCapUsd: state.marketValueUsd || 0,
    launchLiquidityUsd: state.liquidityUsd || fallback.launchLiquidityUsd,
    circulating: state.circulatingSupply || fallback.circulating,
    tradableSupply: state.tradableSupply,
    burnedSupply: state.burnedSupply,
    supplyDistribution: state.supplyDistribution,
    fullyDilutedValueUsd: state.fullyDilutedValueUsd,
    marketValueBasis: state.marketValueBasis,
    marketValueNote: state.marketValueNote,
    isMarketValueReliable: state.isMarketValueReliable,
  };
}

export function songAssetPersistFields(state: SongAssetState, fallback: SongLike = {}) {
  return {
    price: state.priceSol || fallback.price || 0,
    currentPriceSol: state.priceSol || fallback.currentPriceSol || 0,
    currentPriceUsd: state.priceUsd || fallback.currentPriceUsd || 0,
    marketCap: state.marketValueSol || 0,
    marketCapUsd: state.marketValueUsd || 0,
    launchLiquidityUsd: state.liquidityUsd || fallback.launchLiquidityUsd || 0,
  };
}

export function withSongAssetState<T extends SongLike>(song: T, state: SongAssetState) {
  return {
    ...song,
    ...songAssetReadFields(state, song),
  };
}

export async function refreshSongAssetState(songId: string) {
  const song = await prisma.songToken.findUnique({
    where: { id: songId },
    include: {
      events: {
        where: { kind: "BURN" },
        select: { kind: true, payload: true },
        take: 100,
      },
    },
  });
  if (!song) return null;
  const rates = await getSongAssetRates(song);
  const state = buildSongAssetState(song, rates);
  const updated = await prisma.songToken.update({
    where: { id: song.id },
    data: songAssetPersistFields(state, song),
  });
  return { song: withSongAssetState(updated, state), state };
}
