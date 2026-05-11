/**
 * Bonding curve for Song Tokens.
 *
 * Spot price as a function of circulating supply:
 *   p(s) = basePrice + slope * s
 *
 * Reserve (integral of price 0..s):
 *   R(s) = basePrice * s + 0.5 * slope * s^2
 *
 * Cost to buy `dx` tokens from circulating `s`:
 *   cost = R(s + dx) - R(s)
 *        = basePrice * dx + 0.5 * slope * ((s+dx)^2 - s^2)
 *
 * Proceeds from selling `dx` tokens from circulating `s`:
 *   proceeds = R(s) - R(s - dx)
 *
 * The performance multiplier scales the EFFECTIVE price (and therefore
 * cost / proceeds) without changing the curve geometry, so streaming
 * growth raises the price floor everyone trades against.
 */

export interface CurveParams {
  basePrice: number;
  slope: number;
  circulating: number;
  performance: number; // >= 0, typical 0.5..5
}

const FEE_BPS = 50; // 0.50% protocol fee

function reserve(s: number, basePrice: number, slope: number): number {
  return basePrice * s + 0.5 * slope * s * s;
}

export function spotPrice(params: CurveParams): number {
  const raw = params.basePrice + params.slope * params.circulating;
  return raw * Math.max(0.01, params.performance);
}

export interface QuoteResult {
  tokens: number;
  cost: number;     // SOL paid (BUY) or received (SELL) before fee
  fee: number;
  total: number;    // SOL paid (BUY = cost+fee) or received (SELL = cost-fee)
  avgPrice: number; // SOL per token
  newCirculating: number;
  newSpotPrice: number;
  slippageBps: number;
}

/** Quote a BUY: user spends `solIn` SOL, receives tokens. */
export function quoteBuyBySol(params: CurveParams, solIn: number): QuoteResult {
  if (solIn <= 0) throw new Error("solIn must be > 0");
  const perf = Math.max(0.01, params.performance);
  const effIn = solIn / perf; // tokens are priced against effective curve

  // Solve for dx: basePrice*dx + 0.5*slope*((s+dx)^2 - s^2) = effIn
  // 0.5*slope*dx^2 + (basePrice + slope*s)*dx - effIn = 0
  const a = 0.5 * params.slope;
  const b = params.basePrice + params.slope * params.circulating;
  const c = -effIn;
  const disc = b * b - 4 * a * c;
  const dx = a === 0 ? -c / b : (-b + Math.sqrt(disc)) / (2 * a);

  const before = spotPrice(params);
  const newCirc = params.circulating + dx;
  const after = spotPrice({ ...params, circulating: newCirc });
  const fee = (solIn * FEE_BPS) / 10_000;
  const cost = solIn - fee;
  const avg = cost / dx;
  const slippageBps = Math.round(((after - before) / before) * 10_000);
  return {
    tokens: dx,
    cost,
    fee,
    total: solIn,
    avgPrice: avg,
    newCirculating: newCirc,
    newSpotPrice: after,
    slippageBps,
  };
}

/** Quote a BUY by exact token amount. */
export function quoteBuyByTokens(params: CurveParams, tokens: number): QuoteResult {
  if (tokens <= 0) throw new Error("tokens must be > 0");
  const perf = Math.max(0.01, params.performance);
  const r0 = reserve(params.circulating, params.basePrice, params.slope);
  const r1 = reserve(params.circulating + tokens, params.basePrice, params.slope);
  const effCost = r1 - r0;
  const cost = effCost * perf;
  const fee = (cost * FEE_BPS) / 10_000;
  const total = cost + fee;
  const newCirc = params.circulating + tokens;
  const before = spotPrice(params);
  const after = spotPrice({ ...params, circulating: newCirc });
  return {
    tokens,
    cost,
    fee,
    total,
    avgPrice: cost / tokens,
    newCirculating: newCirc,
    newSpotPrice: after,
    slippageBps: Math.round(((after - before) / before) * 10_000),
  };
}

/** Quote a SELL by exact token amount. */
export function quoteSellByTokens(params: CurveParams, tokens: number): QuoteResult {
  if (tokens <= 0) throw new Error("tokens must be > 0");
  if (tokens > params.circulating) throw new Error("Insufficient liquidity");
  const perf = Math.max(0.01, params.performance);
  const r0 = reserve(params.circulating, params.basePrice, params.slope);
  const r1 = reserve(params.circulating - tokens, params.basePrice, params.slope);
  const effProceeds = r0 - r1;
  const gross = effProceeds * perf;
  const fee = (gross * FEE_BPS) / 10_000;
  const total = gross - fee;
  const newCirc = params.circulating - tokens;
  const before = spotPrice(params);
  const after = spotPrice({ ...params, circulating: newCirc });
  return {
    tokens,
    cost: gross,
    fee,
    total,
    avgPrice: gross / tokens,
    newCirculating: newCirc,
    newSpotPrice: after,
    slippageBps: Math.round(((before - after) / before) * 10_000),
  };
}

export function marketCap(params: CurveParams): number {
  return spotPrice(params) * params.circulating;
}

export const FEES = { TRADE_BPS: FEE_BPS };
