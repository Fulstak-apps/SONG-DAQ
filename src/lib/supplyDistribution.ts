export type SupplyDistributionInput = {
  supply?: number | null;
  circulating?: number | null;
  liquidityTokenAmount?: number | null;
  artistAllocationBps?: number | null;
  burnedSupply?: number | null;
};

export type BurnableSupplyInput = SupplyDistributionInput & {
  artistShareBps?: number | null;
  holderShareBps?: number | null;
  protocolShareBps?: number | null;
};

export type SupplyDistribution = {
  totalSupply: number;
  publicLiquiditySupply: number;
  circulatingSupply: number;
  artistAllocationSupply: number;
  reserveSupply: number;
  burnedSupply: number;
  publicLiquidityBps: number;
  circulatingBps: number;
  artistAllocationBps: number;
  reserveBps: number;
  burnedBps: number;
};

function safeNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function bps(amount: number, total: number) {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(10_000, Math.round((amount / total) * 10_000)));
}

export function calculateSupplyDistribution(input: SupplyDistributionInput): SupplyDistribution {
  const totalSupply = safeNumber(input.supply);
  const publicLiquiditySupply = Math.min(safeNumber(input.liquidityTokenAmount), totalSupply);
  const circulatingSupply = Math.min(safeNumber(input.circulating), totalSupply);
  const artistTarget = Math.min(
    totalSupply,
    Math.round(totalSupply * (safeNumber(input.artistAllocationBps) / 10_000)),
  );
  const artistAllocationSupply = Math.max(0, Math.min(artistTarget, totalSupply - publicLiquiditySupply));
  const reserveSupply = Math.max(0, totalSupply - publicLiquiditySupply - artistAllocationSupply);
  const burnedSupply = safeNumber(input.burnedSupply);

  return {
    totalSupply,
    publicLiquiditySupply,
    circulatingSupply,
    artistAllocationSupply,
    reserveSupply,
    burnedSupply,
    publicLiquidityBps: bps(publicLiquiditySupply, totalSupply),
    circulatingBps: bps(circulatingSupply, totalSupply),
    artistAllocationBps: bps(artistAllocationSupply, totalSupply),
    reserveBps: bps(reserveSupply, totalSupply),
    burnedBps: bps(burnedSupply, totalSupply + burnedSupply),
  };
}

export function getBurnedSupplyFromEvents(events: Array<{ kind?: string | null; payload?: unknown }> | null | undefined) {
  let summed = 0;
  let cumulative = 0;
  for (const event of events ?? []) {
    if (String(event?.kind || "").toUpperCase() !== "BURN") continue;
    try {
      const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
      summed += safeNumber((payload as any)?.amount);
      cumulative = Math.max(cumulative, safeNumber((payload as any)?.cumulativeBurned));
    } catch {}
  }
  return Math.max(summed, cumulative);
}

export function applyBurnToSupply(input: BurnableSupplyInput, amount: number, burnedFromArtistWallet: boolean) {
  const burnAmount = safeNumber(amount);
  const previousSupply = safeNumber(input.supply);
  const nextSupply = Math.max(0, previousSupply - burnAmount);
  const previousArtistSupply = Math.round(previousSupply * (safeNumber(input.artistAllocationBps) / 10_000));
  const nextArtistSupply = burnedFromArtistWallet
    ? Math.max(0, previousArtistSupply - burnAmount)
    : Math.min(previousArtistSupply, nextSupply);
  const nextCirculating = burnedFromArtistWallet
    ? Math.min(safeNumber(input.circulating), nextSupply)
    : Math.max(0, Math.min(safeNumber(input.circulating), nextSupply) - burnAmount);
  const nextLiquidityTokenAmount = Math.min(safeNumber(input.liquidityTokenAmount), nextSupply);
  const nextArtistAllocationBps = bps(nextArtistSupply, nextSupply);

  return {
    supply: nextSupply,
    circulating: nextCirculating,
    liquidityTokenAmount: nextLiquidityTokenAmount,
    artistAllocationBps: nextArtistAllocationBps,
    distribution: calculateSupplyDistribution({
      supply: nextSupply,
      circulating: nextCirculating,
      liquidityTokenAmount: nextLiquidityTokenAmount,
      artistAllocationBps: nextArtistAllocationBps,
      burnedSupply: safeNumber(input.burnedSupply) + burnAmount,
    }),
  };
}
