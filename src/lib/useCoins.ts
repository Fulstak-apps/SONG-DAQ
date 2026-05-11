"use client";
import { useEffect, useMemo, useState } from "react";
import type { AudiusCoin } from "./audiusCoins";
import { applyPaperMarket } from "./paperMarket";
import { readJson } from "./safeJson";
import { usePaperTrading } from "./store";

/**
 * Shared in-memory cache for the coins feed. Multiple components subscribe
 * to the same key and share a single network request + polling loop. This
 * avoids the dashboard, sidebar, and command palette each polling /api/coins
 * independently every 8s.
 */
type Entry = {
  coins: AudiusCoin[];
  promise: Promise<AudiusCoin[]> | null;
  lastFetch: number;
  subscribers: Set<(coins: AudiusCoin[]) => void>;
  intervalId: ReturnType<typeof setInterval> | null;
};

const cache: Map<string, Entry> = (globalThis as any).__songdaqCoinCache
  ?? ((globalThis as any).__songdaqCoinCache = new Map());

const POLL_MS = 10_000;
const STALE_MS = 5_000;

function getEntry(sort: string): Entry {
  let e = cache.get(sort);
  if (!e) {
    e = { coins: [], promise: null, lastFetch: 0, subscribers: new Set(), intervalId: null };
    cache.set(sort, e);
  }
  return e;
}

async function fetchOnce(sort: string): Promise<AudiusCoin[]> {
  const r = await fetch(`/api/coins?sort=${sort}&limit=36`, { cache: "no-store" });
  const j = await readJson<{ coins?: AudiusCoin[] }>(r);
  if (!r.ok) throw new Error(j && "error" in j ? String((j as any).error) : `Coins request failed (${r.status})`);
  return j?.coins ?? [];
}

function ensurePolling(sort: string) {
  const e = getEntry(sort);
  if (e.intervalId) return;
  e.intervalId = setInterval(async () => {
    if (!e.subscribers.size) return;
    try {
      const coins = await fetchOnce(sort);
      e.coins = coins;
      e.lastFetch = Date.now();
      e.subscribers.forEach((cb) => cb(coins));
    } catch { /* swallow */ }
  }, POLL_MS);
}

export function useCoins(sort: "quality" | "marketCap" | "volume" | "gainers" | "holders" = "quality") {
  const e = getEntry(sort);
  const [coins, setCoins] = useState<AudiusCoin[]>(e.coins);
  const [loading, setLoading] = useState(!e.coins.length);
  const paperMode = usePaperTrading((s) => s.enabled);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const cb = (c: AudiusCoin[]) => { if (alive) setCoins(c); };
    e.subscribers.add(cb);

    // Trigger an immediate fetch if the cache is stale or empty.
    const stale = !e.coins.length || Date.now() - e.lastFetch > STALE_MS;
    if (stale) {
      if (!e.promise) {
        e.promise = fetchOnce(sort)
          .then((c) => { e.coins = c; e.lastFetch = Date.now(); return c; })
          .finally(() => { e.promise = null; });
      }
      e.promise
        .then((c) => { if (alive) { setCoins(c); setLoading(false); } e.subscribers.forEach((s) => s(c)); })
        .catch(() => { if (alive) setLoading(false); });
    } else {
      setLoading(false);
    }
    ensurePolling(sort);

    return () => {
      alive = false;
      e.subscribers.delete(cb);
      // Stop polling once nobody listens.
      if (!e.subscribers.size && e.intervalId) {
        clearInterval(e.intervalId);
        e.intervalId = null;
      }
    };
  }, [sort, e]);

  useEffect(() => {
    if (!paperMode) return;
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, [paperMode]);

  const liveCoins = useMemo(() => {
    if (!paperMode) return coins;
    return applyPaperMarket(coins, tick);
  }, [coins, paperMode, tick]);

  return { coins: liveCoins, loading };
}
