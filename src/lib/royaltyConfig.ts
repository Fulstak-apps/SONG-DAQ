/**
 * Artist-controlled royalty config — bounded so investors get
 * predictable economics. Splits are stored in basis points (1bps = 0.01%)
 * and must sum to exactly 10_000.
 *
 *   artist:   2000–8000 bps (20–80%)
 *   holders:  1000–6000 bps (≥10%, ≤60%)   ← floor protects investors
 *   protocol: 1000–3000 bps (10–30%)        ← floor protects liquidity
 */

export interface RoyaltyConfig {
  artistShareBps: number;
  holderShareBps: number;
  protocolShareBps: number;
  streamingEnabled: boolean;
  tradingFeesEnabled: boolean;
  externalRevenueEnabled: boolean;
}

export const ROYALTY_BOUNDS = {
  artist:   { min: 2000, max: 8000 },
  holders:  { min: 1000, max: 6000 },
  protocol: { min: 1000, max: 3000 },
} as const;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateRoyalty(c: RoyaltyConfig): ValidationResult {
  const errors: string[] = [];
  const sum = c.artistShareBps + c.holderShareBps + c.protocolShareBps;
  if (sum !== 10_000) errors.push(`Splits must sum to 100% (got ${(sum / 100).toFixed(2)}%)`);
  if (c.artistShareBps < ROYALTY_BOUNDS.artist.min || c.artistShareBps > ROYALTY_BOUNDS.artist.max)
    errors.push(`Artist share must be 20–80% (got ${(c.artistShareBps / 100).toFixed(0)}%)`);
  if (c.holderShareBps < ROYALTY_BOUNDS.holders.min || c.holderShareBps > ROYALTY_BOUNDS.holders.max)
    errors.push(`Holder share must be 10–60% (got ${(c.holderShareBps / 100).toFixed(0)}%)`);
  if (c.protocolShareBps < ROYALTY_BOUNDS.protocol.min || c.protocolShareBps > ROYALTY_BOUNDS.protocol.max)
    errors.push(`Protocol share must be 10–30% (got ${(c.protocolShareBps / 100).toFixed(0)}%)`);
  if (!c.streamingEnabled && !c.tradingFeesEnabled && !c.externalRevenueEnabled)
    errors.push("At least one revenue stream must be enabled");
  return { ok: errors.length === 0, errors };
}

export const DEFAULT_ROYALTY: RoyaltyConfig = {
  artistShareBps: 5000,
  holderShareBps: 3000,
  protocolShareBps: 2000,
  streamingEnabled: true,
  tradingFeesEnabled: true,
  externalRevenueEnabled: false,
};

/** Split a SOL amount through the config. */
export function splitRevenue(total: number, c: RoyaltyConfig) {
  return {
    toArtist: total * c.artistShareBps / 10_000,
    toHolders: total * c.holderShareBps / 10_000,
    toTreasury: total * c.protocolShareBps / 10_000,
  };
}
