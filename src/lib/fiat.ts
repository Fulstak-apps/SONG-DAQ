"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_DISPLAY_CURRENCY = "USD";
export const DISPLAY_CURRENCY_KEY = "songdaq-display-currency";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";

export type FiatPrice = {
  usd: number | null;
  source?: string;
};

export function assetIdForSymbol(symbol: string | null | undefined) {
  const upper = String(symbol || "").trim().toUpperCase();
  if (upper === "SOL") return "SOL";
  if (upper === "AUDIO" || upper === "$AUDIO") return "AUDIO";
  if (upper === "USDC") return "USDC";
  return upper;
}

export function formatFiat(value: number | null | undefined, currency = DEFAULT_DISPLAY_CURRENCY, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return "Fiat estimate unavailable";
  const amount = Number(value);
  const abs = Math.abs(amount);
  if (abs > 0 && abs < 0.000001) {
    const tiny = amount.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
    if (tiny === "0") return `<${new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 12 }).format(0.000000000001)}`;
    const symbol = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? "$";
    return `${amount < 0 ? "-" : ""}${symbol}${tiny.replace(/^-?0?/, "0")}`;
  }
  const maxDigits = abs >= 1 ? digits : Math.max(digits, 4);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: abs >= 1 ? Math.min(digits, 2) : 0,
  }).format(amount);
}

export function formatFiatEstimate(value: number | null | undefined, currency = DEFAULT_DISPLAY_CURRENCY, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return "Fiat estimate unavailable";
  return `≈ ${formatFiat(value, currency, digits)} ${currency}`;
}

export function formatCryptoAmount(amount: number | null | undefined, symbol: string, digits = 6) {
  if (amount == null || !Number.isFinite(Number(amount))) return `— ${symbol}`;
  const n = Number(amount);
  const formatted = Math.abs(n) >= 1000
    ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : Math.abs(n) >= 1
      ? n.toLocaleString(undefined, { maximumFractionDigits: Math.min(digits, 4) })
      : n.toLocaleString(undefined, { maximumFractionDigits: digits });
  return `${formatted} ${symbol}`;
}

export function formatCryptoWithFiat(
  amount: number | null | undefined,
  symbol: string,
  fiatValue: number | null | undefined,
  currency = DEFAULT_DISPLAY_CURRENCY,
  digits = 6,
) {
  return `${formatCryptoAmount(amount, symbol, digits)} ${formatFiatEstimate(fiatValue, currency)}`;
}

export function priceAgeText(updatedAt: string | null | undefined) {
  if (!updatedAt) return "Fiat estimate unavailable";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "Fiat estimate unavailable";
  if (seconds < 5) return "Estimated price updated just now";
  if (seconds < 60) return `Estimated price updated ${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  return `Estimated price updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

export function useDisplayCurrency() {
  const [currency, setCurrencyState] = useState(DEFAULT_DISPLAY_CURRENCY);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISPLAY_CURRENCY_KEY);
      setCurrencyState(stored || DEFAULT_DISPLAY_CURRENCY);
    } catch {
      setCurrencyState(DEFAULT_DISPLAY_CURRENCY);
    }
  }, []);

  const setCurrency = (next: string) => {
    const clean = String(next || DEFAULT_DISPLAY_CURRENCY).toUpperCase();
    setCurrencyState(clean);
    try {
      window.localStorage.setItem(DISPLAY_CURRENCY_KEY, clean);
    } catch {}
  };

  return { currency, setCurrency };
}

export function useLiveFiatPrices(ids: Array<string | null | undefined>) {
  const { currency } = useDisplayCurrency();
  const idsKey = ids.map(assetIdForSymbol).join("|");
  const normalized = useMemo(() => (
    Array.from(new Set(ids.map(assetIdForSymbol).filter(Boolean))).sort()
  ), [idsKey]);
  const [prices, setPrices] = useState<Record<string, FiatPrice>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!normalized.length) return;
    let alive = true;
    const load = async () => {
      try {
        const qs = new URLSearchParams({ ids: normalized.join(","), currency });
        const res = await fetch(`/api/prices?${qs.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Fiat price unavailable");
        if (!alive) return;
        setPrices(json?.prices ?? {});
        setUpdatedAt(json?.updatedAt ?? new Date().toISOString());
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Fiat price unavailable");
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(timer); };
  }, [normalized.join(","), currency]);

  return { currency, prices, updatedAt, error };
}
