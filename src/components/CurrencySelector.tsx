"use client";

import { COMMON_DISPLAY_CURRENCIES, priceAgeText, useUsdToDisplayRate } from "@/lib/fiat";

export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { currency, setCurrency, updatedAt, error } = useUsdToDisplayRate();
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-xl border border-edge bg-white/[0.055] text-mute transition hover:border-neon/30 hover:text-ink ${
        compact ? "h-9 px-2 text-[8px]" : "h-10 px-3 text-[9px]"
      }`}
      title={error || priceAgeText(updatedAt)}
    >
      <span className="font-black uppercase tracking-widest">Fiat</span>
      <select
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        className="bg-transparent font-mono font-black uppercase text-ink outline-none"
        aria-label="Display currency"
      >
        {COMMON_DISPLAY_CURRENCIES.map((code) => (
          <option key={code} value={code} className="bg-[#0b0e12] text-white">
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}
