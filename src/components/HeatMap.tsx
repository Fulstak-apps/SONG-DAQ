"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AudiusCoin } from "@/lib/audiusCoins";

/**
 * Treemap-style heat map: tile size by market cap, color by 24h % change.
 */
function squarify(items: { area: number; ref: AudiusCoin }[], total: number) {
  return items.map((it) => ({
    ...it,
    pct: total > 0 ? it.area / total : 0,
  }));
}

function colorFor(change: number) {
  const c = Math.max(-12, Math.min(12, change)) / 12;
  if (c >= 0) {
    const a = 0.1 + 0.5 * c;
    return `rgba(0,229,114,${a.toFixed(3)})`;
  }
  const a = 0.1 + 0.5 * Math.abs(c);
  return `rgba(255,51,102,${a.toFixed(3)})`;
}

function fmtUsd(n: number) {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function HeatMap({
  coins,
  onSelect,
}: {
  coins: AudiusCoin[];
  onSelect?: (c: AudiusCoin) => void;
}) {
  const tiles = useMemo(() => {
    const filtered = coins
      .filter((c) => (c.marketCap ?? 0) > 0)
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    const total = filtered.reduce((s, c) => s + (c.marketCap ?? 0), 0);
    return squarify(
      filtered.map((c) => ({ area: c.marketCap ?? 0, ref: c })),
      total,
    );
  }, [coins]);

  if (!tiles.length) {
    return <div className="panel-elevated p-10 text-center text-white/20 text-sm font-bold grain">No data for heat map.</div>;
  }

  return (
    <div className="panel-elevated p-4 grain relative overflow-hidden">
      <div className="orb orb-neon w-[300px] h-[300px] -top-20 -right-20 opacity-20" />
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="label">Market Heat Map · size by cap, color by 24h%</div>
        <div className="flex items-center gap-2 text-[10px] text-white/15 font-bold">
          <span>−10%</span>
          <div className="h-1.5 w-32 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, rgba(255,51,102,0.5), rgba(255,51,102,0.1), rgba(0,229,114,0.1), rgba(0,229,114,0.5))" }} />
          <span>+10%</span>
        </div>
      </div>
      <div
        className="grid gap-1 relative z-10"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gridAutoRows: "minmax(56px, auto)",
        }}
      >
        {tiles.map(({ ref: c, pct }, i) => {
          const change = c.priceChange24hPercent ?? 0;
          const colSpan = pct > 0.12 ? 3 : pct > 0.06 ? 2 : 1;
          const rowSpan = pct > 0.18 ? 3 : pct > 0.09 ? 2 : 1;
          return (
            <motion.button
              key={c.mint}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onSelect?.(c)}
              className="rounded-xl border border-white/[0.04] px-3 py-2 flex flex-col justify-between text-left hover:border-white/10 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-neon/30 relative overflow-hidden"
              style={{
                gridColumn: `span ${colSpan}`,
                gridRow: `span ${rowSpan}`,
                background: colorFor(change),
              }}
              title={`${c.name} · ${fmtUsd(c.marketCap ?? 0)} · ${change.toFixed(2)}%`}
            >
              <div className="font-mono text-xs font-bold truncate text-white">${c.ticker}</div>
              <div className="flex items-baseline justify-between gap-1 mt-1">
                <span className="text-[10px] text-white/60 truncate">{fmtUsd(c.marketCap ?? 0)}</span>
                <span className={`text-[11px] font-mono font-bold ${change >= 0 ? "text-neon" : "text-red"}`}>
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
