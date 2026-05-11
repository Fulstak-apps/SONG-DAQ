import { CHART_RANGE_MS, type ChartRange } from "@/lib/chartRanges";

/**
 * In-memory rolling price history for Audius coins.
 *
 * The Audius public API exposes live `price` plus, when available, a
 * `history24hPrice` spot. We only record observed/indexed points. No visual
 * interpolation or fake backfill lives here.
 *
 * This is per-process and lost on restart — fine for dev. Swap to Redis/DB
 * for production.
 */
export interface Tick { t: number; p: number; v: number }

const MAX_TICKS = 720; // ~ 1h at 5s, or 6h at 30s
const HISTORY_MS = 7 * 24 * 60 * 60 * 1000; // keep up to a week

const store: Map<string, Tick[]> = (globalThis as any).__songdaqCoinTicks
  ?? ((globalThis as any).__songdaqCoinTicks = new Map());

function initialTicks(currentPrice: number, history24hPrice: number, v24hUSD: number) {
  const now = Date.now();
  const ticks: Tick[] = [];
  if (history24hPrice > 0 && history24hPrice !== currentPrice) {
    ticks.push({ t: now - 24 * 60 * 60 * 1000, p: history24hPrice, v: v24hUSD || 0 });
  }
  ticks.push({ t: now, p: currentPrice, v: 0 });
  return ticks;
}

export function recordTick(
  mint: string,
  price: number,
  v24hUSD = 0,
  history24hPrice = 0,
) {
  if (!mint || !isFinite(price) || price <= 0) return;
  let arr = store.get(mint);
  if (!arr) {
    arr = initialTicks(price, history24hPrice, v24hUSD);
    store.set(mint, arr);
    return;
  }
  const last = arr[arr.length - 1];
  if (!last || Date.now() - last.t > 5_000) {
    arr.push({ t: Date.now(), p: price, v: 0 });
    if (arr.length > MAX_TICKS) arr.shift();
  } else {
    last.p = price; // de-dup intra-window
  }
}

export function getTicks(mint: string): Tick[] {
  return store.get(mint) ?? [];
}

export type CoinRange = ChartRange;

export function getCandles(mint: string, range: CoinRange = "LIVE") {
  const ticks = getTicks(mint);
  if (!ticks.length) return [];
  const windowMs = range === "ALL" ? HISTORY_MS : (CHART_RANGE_MS[range] ?? CHART_RANGE_MS.LIVE);
  const cutoff = Date.now() - windowMs;
  const filtered = ticks.filter((t) => t.t >= cutoff);
  // Bucket into ~80 candles for chart readability.
  const targetBars = 80;
  const minBucketMs = windowMs <= 60_000 ? 1_000 : windowMs <= 15 * 60_000 ? 5_000 : 60_000;
  const bucketMs = Math.max(minBucketMs, Math.floor((Date.now() - (filtered[0]?.t ?? Date.now())) / targetBars) || minBucketMs);
  type Bar = { ts: string; open: number; high: number; low: number; close: number; volume: number };
  const out: Bar[] = [];
  let bucket: Tick[] = [];
  let bucketStart = filtered[0]?.t ?? Date.now();
  for (const t of filtered) {
    if (t.t - bucketStart > bucketMs && bucket.length) {
      const ps = bucket.map((b) => b.p);
      out.push({
        ts: new Date(bucket[bucket.length - 1].t).toISOString(),
        open: ps[0],
        high: Math.max(...ps),
        low: Math.min(...ps),
        close: ps[ps.length - 1],
        volume: bucket.reduce((s, b) => s + (b.v || 0), 0),
      });
      bucket = [];
      bucketStart = t.t;
    }
    bucket.push(t);
  }
  if (bucket.length) {
    const ps = bucket.map((b) => b.p);
    out.push({
      ts: new Date(bucket[bucket.length - 1].t).toISOString(),
      open: ps[0],
      high: Math.max(...ps),
      low: Math.min(...ps),
      close: ps[ps.length - 1],
      volume: bucket.reduce((s, b) => s + (b.v || 0), 0),
    });
  }
  return out;
}
