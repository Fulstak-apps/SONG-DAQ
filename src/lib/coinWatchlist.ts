"use client";
import { useEffect, useState, useCallback } from "react";

const KEY = "songdaq.coin.watchlist";
const RECENT_KEY = "songdaq.coin.recent";

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}
function write(key: string, mints: string[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(mints)); } catch {}
}

export function useCoinWatchlist() {
  const [mints, setMints] = useState<string[]>([]);
  useEffect(() => {
    setMints(read(KEY));
    const onChange = () => setMints(read(KEY));
    window.addEventListener("storage", onChange);
    window.addEventListener("songdaq:watchlist", onChange as any);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("songdaq:watchlist", onChange as any);
    };
  }, []);
  const toggle = useCallback((mint: string) => {
    const cur = read(KEY);
    const next = cur.includes(mint) ? cur.filter((m) => m !== mint) : [mint, ...cur];
    write(KEY, next.slice(0, 100));
    setMints(read(KEY));
    window.dispatchEvent(new CustomEvent("songdaq:watchlist"));
  }, []);
  const has = useCallback((mint: string) => mints.includes(mint), [mints]);
  return { mints, toggle, has };
}

export function useRecentCoins() {
  const [mints, setMints] = useState<string[]>([]);
  useEffect(() => {
    setMints(read(RECENT_KEY));
    const onChange = () => setMints(read(RECENT_KEY));
    window.addEventListener("storage", onChange);
    window.addEventListener("songdaq:recent", onChange as any);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("songdaq:recent", onChange as any);
    };
  }, []);
  const push = useCallback((mint: string) => {
    if (!mint) return;
    const cur = read(RECENT_KEY).filter((m) => m !== mint);
    cur.unshift(mint);
    write(RECENT_KEY, cur.slice(0, 8));
    setMints(read(RECENT_KEY));
    window.dispatchEvent(new CustomEvent("songdaq:recent"));
  }, []);
  return { mints, push };
}
