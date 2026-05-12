"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_DISPLAY_CURRENCY = "USD";
export const DISPLAY_CURRENCY_KEY = "songdaq-display-currency";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";

export type FiatPrice = {
  /** Back-compat field used throughout the UI: price in the selected display currency. */
  usd: number | null;
  /** Same value as usd, named correctly for new code. */
  fiat?: number | null;
  /** Original USD price from the upstream feed when available. */
  usdPrice?: number | null;
  currency?: string;
  source?: string;
  estimated?: boolean;
};

const REGION_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  KR: "KRW",
  BR: "BRL",
  MX: "MXN",
  IN: "INR",
  NG: "NGN",
  ZA: "ZAR",
  CH: "CHF",
  CN: "CNY",
  HK: "HKD",
  SG: "SGD",
  AE: "AED",
  SA: "SAR",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
};

const EURO_REGIONS = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT",
  "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
]);

export const COMMON_DISPLAY_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "MXN", "BRL", "NGN", "ZAR", "INR"];

export function detectDisplayCurrency(locale?: string) {
  try {
    const loc = new Intl.Locale(locale || navigator.language);
    const region = loc.region?.toUpperCase();
    if (!region) return DEFAULT_DISPLAY_CURRENCY;
    if (EURO_REGIONS.has(region)) return "EUR";
    return REGION_CURRENCY[region] || DEFAULT_DISPLAY_CURRENCY;
  } catch {
    return DEFAULT_DISPLAY_CURRENCY;
  }
}

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
      setCurrencyState(stored || detectDisplayCurrency());
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

export function fiatPriceValue(price: FiatPrice | null | undefined) {
  return Number(price?.fiat ?? price?.usd ?? 0);
}

type DisplayRateCacheEntry = {
  rate: number;
  updatedAt: string | null;
  error: string | null;
  loadedAt: number;
};

const displayRateCache = new Map<string, DisplayRateCacheEntry>();
const displayRateInflight = new Map<string, Promise<DisplayRateCacheEntry>>();

async function fetchDisplayRate(currency: string): Promise<DisplayRateCacheEntry> {
  const cached = displayRateCache.get(currency);
  if (cached && Date.now() - cached.loadedAt < 60_000) return cached;

  const existing = displayRateInflight.get(currency);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const qs = new URLSearchParams({ ids: "USDC", currency });
      const res = await fetch(`/api/prices?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Fiat conversion unavailable");
      const entry: DisplayRateCacheEntry = {
        rate: Number(json?.conversionRate ?? json?.prices?.USDC?.fiat ?? json?.prices?.USDC?.usd ?? (currency === "USD" ? 1 : 0)),
        updatedAt: json?.updatedAt ?? new Date().toISOString(),
        error: null,
        loadedAt: Date.now(),
      };
      displayRateCache.set(currency, entry);
      return entry;
    } catch (err) {
      const entry: DisplayRateCacheEntry = {
        rate: currency === "USD" ? 1 : 0,
        updatedAt: null,
        error: err instanceof Error ? err.message : "Fiat conversion unavailable",
        loadedAt: Date.now(),
      };
      displayRateCache.set(currency, entry);
      return entry;
    } finally {
      displayRateInflight.delete(currency);
    }
  })();

  displayRateInflight.set(currency, promise);
  return promise;
}

export function useUsdToDisplayRate() {
  const { currency, setCurrency } = useDisplayCurrency();
  const [rate, setRate] = useState(currency === "USD" ? 1 : 0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const entry = await fetchDisplayRate(currency);
      if (!alive) return;
      setRate(entry.rate);
      setUpdatedAt(entry.updatedAt);
      setError(entry.error);
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, [currency]);

  const convertUsd = (usd: number | null | undefined) => {
    if (usd == null || !Number.isFinite(Number(usd)) || !(rate > 0)) return null;
    return Number(usd) * rate;
  };

  const formatUsd = (usd: number | null | undefined, digits = 2) => formatFiat(convertUsd(usd), currency, digits);
  const formatUsdEstimate = (usd: number | null | undefined, digits = 2) => formatFiatEstimate(convertUsd(usd), currency, digits);

  return { currency, setCurrency, rate, updatedAt, error, convertUsd, formatUsd, formatUsdEstimate };
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
