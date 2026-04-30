/**
 * In-memory rolling price history for Audius coins.
 *
 * The Audius public API exposes only `price` and `history24hPrice` (a 24h-old
 * spot). For a stock-style chart we need a denser series, so we record a tick
 * every time the server fetches /api/coins, and synthesize a 24h backfill
 * (linear-interp + jitter) on first sight of a mint so the chart is never
 * empty.
 *
 * This is per-process and lost on restart — fine for dev. Swap to Redis/DB
 * for production.
 */
export interface Tick { t: number; p: number; v: number }

const MAX_TICKS = 720; // ~ 1h at 5s, or 6h at 30s
const HISTORY_MS = 7 * 24 * 60 * 60 * 1000; // keep up to a week

const store: Map<string, Tick[]> = (globalThis as any).__songdaqCoinTicks
  ?? ((globalThis as any).__songdaqCoinTicks = new Map());

function backfill(mint: string, currentPrice: number, history24hPrice: number, v24hUSD: number) {
  const now = Date.now();
  const bars = 48;
  const stepMs = (24 * 60 * 60 * 1000) / bars;
  const ticks: Tick[] = [];
  let p = history24hPrice || currentPrice;
  for (let i = bars; i >= 0; i--) {
    const t = now - i * stepMs;
    // log-linear interpolate, sprinkle jitter so chart isn't visually flat.
    const f = (bars - i) / bars;
    const target = (history24hPrice || currentPrice) * Math.pow(
      currentPrice / (history24hPrice || currentPrice || 1),
      f,
    );
    const jitter = 1 + (Math.random() - 0.5) * 0.015;
    p = target * jitter;
    ticks.push({ t, p, v: (v24hUSD || 0) / bars });
  }
  // Last point exactly equals live price.
  ticks[ticks.length - 1] = { t: now, p: currentPrice, v: 0 };
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
    arr = backfill(mint, price, history24hPrice, v24hUSD);
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

export function getCandles(mint: string, range: "1H" | "1D" | "1W" | "ALL" = "1D") {
  const ticks = getTicks(mint);
  if (!ticks.length) return [];
  const RANGE_MS: Record<string, number> = {
    "1H": 3_600_000,
    "1D": 86_400_000,
    "1W": 7 * 86_400_000,
    "ALL": HISTORY_MS,
  };
  const cutoff = Date.now() - RANGE_MS[range];
  const filtered = ticks.filter((t) => t.t >= cutoff);
  // Bucket into ~80 candles for chart readability.
  const targetBars = 80;
  const bucketMs = Math.max(60_000, Math.floor((Date.now() - (filtered[0]?.t ?? Date.now())) / targetBars) || 60_000);
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
