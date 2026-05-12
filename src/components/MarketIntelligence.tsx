"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Bell, Layers3, LockKeyhole } from "lucide-react";
import { calculateCoinRisk } from "@/lib/risk/calculateCoinRisk";
import { useAlerts } from "@/lib/store";
import type { AudiusCoin } from "@/lib/audiusCoins";
import { useUsdToDisplayRate } from "@/lib/fiat";

function short(addr?: string) {
  if (!addr) return "-";
  return addr.length > 14 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

export function MarketDepthPanel({ coin }: { coin: AudiusCoin & Record<string, any> }) {
  const { formatUsd: formatDisplayFiat } = useUsdToDisplayRate();
  const price = Number(coin.price ?? 0);
  const liquidity = Math.max(1, Number(coin.liquidity ?? coin.reserveSol ?? coin.liquidityPairAmount ?? 0));
  const rows = useMemo(() => {
    const sizes = [250, 500, 1_000, 2_500, 5_000, 10_000];
    return sizes.map((notional) => {
      const depthRatio = notional / Math.max(liquidity, 1);
      const buyImpact = Math.min(18, depthRatio * 0.45);
      const sellImpact = Math.min(18, depthRatio * 0.52);
      return {
        notional,
        bid: price * (1 - sellImpact / 100),
        ask: price * (1 + buyImpact / 100),
        buyImpact,
        sellImpact,
      };
    });
  }, [price, liquidity]);

  return (
    <section className="panel p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-edge pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-black text-mute">Market Depth</div>
          <div className="mt-1 text-xl font-black text-ink">Slippage Ladder</div>
        </div>
        <Layers3 size={18} className="text-neon" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[9px] uppercase tracking-widest text-mute">
            <tr>
              <th className="py-2 text-left">Order Size</th>
              <th className="py-2 text-right text-red">Bid</th>
              <th className="py-2 text-right text-neon">Ask</th>
              <th className="py-2 text-right">Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {rows.map((r) => (
              <tr key={r.notional}>
                <td className="py-2 font-mono text-ink">{formatDisplayFiat(r.notional, 0)}</td>
                <td className="py-2 text-right font-mono text-red">{formatDisplayFiat(r.bid, 6)}</td>
                <td className="py-2 text-right font-mono text-neon">{formatDisplayFiat(r.ask, 6)}</td>
                <td className="py-2 text-right font-mono text-mute">{r.buyImpact.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ActivityRiskPanel({ coin }: { coin: AudiusCoin & Record<string, any> }) {
  const risk = calculateCoinRisk(coin);
  const volume = Number(coin.v24hUSD ?? coin.volume24h ?? 0);
  const holders = Number(coin.holder ?? coin.holders ?? 0);
  const uniqueWallets = Number(coin.uniqueWallet24h ?? 0);
  const change = Math.abs(Number(coin.priceChange24hPercent ?? 0));
  const buySellImbalance = Math.abs(Number(coin.buy24h ?? 0) - Number(coin.sell24h ?? 0));
  const flags = [
    {
      label: "Pump velocity",
      on: change > 35 && volume > Math.max(5_000, holders * 75),
      text: "Fast price move with elevated volume.",
    },
    {
      label: "Wash-trade review",
      on: volume > 0 && uniqueWallets > 0 && volume / Math.max(uniqueWallets, 1) > 7_500,
      text: "Volume is high compared with unique wallets.",
    },
    {
      label: "Concentration",
      on: holders > 0 && holders < 25,
      text: "Holder base is still thin.",
    },
    {
      label: "One-sided flow",
      on: buySellImbalance >= 20,
      text: "Buy/sell flow is strongly imbalanced.",
    },
  ];

  return (
    <section className="panel p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-edge pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-black text-mute">Abnormal Activity</div>
          <div className="mt-1 text-xl font-black text-ink">{risk.score}/100 Trust Score</div>
        </div>
        <Activity size={18} className={flags.some((f) => f.on) ? "text-amber" : "text-neon"} />
      </div>
      <div className="grid gap-2">
        {flags.map((f) => (
          <div key={f.label} className={`rounded-xl border px-3 py-2 ${f.on ? "border-amber/25 bg-amber/10" : "border-edge bg-panel2"}`}>
            <div className={`text-[10px] uppercase tracking-widest font-black ${f.on ? "text-amber" : "text-mute"}`}>{f.label}</div>
            <div className="mt-1 text-xs text-mute">{f.on ? f.text : "No active flag."}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TokenAlertsPanel({ coin }: { coin: AudiusCoin & Record<string, any> }) {
  const alerts = useAlerts();
  const { formatUsd: formatDisplayFiat } = useUsdToDisplayRate();
  const [metric, setMetric] = useState<"price" | "volume" | "holders" | "liquidity">("price");
  const [target, setTarget] = useState(String(Number(coin.price ?? 0).toFixed(6)));
  const [direction, setDirection] = useState<"above" | "below">("above");
  const mine = alerts.alerts.filter((a) => a.assetId === coin.mint);

  function addAlert() {
    const targetPrice = Number(target);
    if (!(targetPrice > 0)) return;
    alerts.add({ assetId: coin.mint, symbol: coin.ticker, targetPrice, direction, metric });
  }

  return (
    <section className="panel p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-edge pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-black text-mute">Watchlists & Alerts</div>
          <div className="mt-1 text-xl font-black text-ink">Price Triggers</div>
        </div>
        <Bell size={18} className="text-gold" />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-xl border border-edge bg-panel2 px-3 py-2 text-sm text-ink font-mono" />
        <select value={direction} onChange={(e) => setDirection(e.target.value as "above" | "below")} className="rounded-xl border border-edge bg-panel2 px-3 py-2 text-xs text-ink">
          <option value="above">Above</option>
          <option value="below">Below</option>
        </select>
      </div>
      <select value={metric} onChange={(e) => setMetric(e.target.value as any)} className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2 text-xs text-ink">
        <option value="price">Price</option>
        <option value="volume">Volume</option>
        <option value="holders">Holder count</option>
        <option value="liquidity">Liquidity</option>
      </select>
      <button onClick={addAlert} className="btn-primary w-full h-10 text-[10px] uppercase tracking-widest font-black">Add Alert</button>
      <div className="space-y-2">
        {mine.length ? mine.slice(0, 4).map((a) => (
          <div key={a.id} className="rounded-xl border border-edge bg-panel2 px-3 py-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-mute uppercase tracking-widest font-bold">{a.metric ?? "price"} {a.direction}</span>
            <span className="font-mono text-ink">{formatDisplayFiat(a.targetPrice, 6)}</span>
          </div>
        )) : <div className="text-xs text-mute">No alerts for this token yet.</div>}
      </div>
    </section>
  );
}

export function LiquidityManagementPanel({ coin, isOwner }: { coin: AudiusCoin & Record<string, any>; isOwner?: boolean }) {
  const { formatUsd: formatDisplayFiat } = useUsdToDisplayRate();
  const liquidity = Number(coin.liquidity ?? coin.reserveSol ?? coin.liquidityPairAmount ?? 0);
  const locked = Boolean(coin.liquidityLocked || coin.splitsLocked);
  const health = Math.max(0, Math.min(100, Math.round((liquidity > 0 ? 45 : 0) + Math.min(liquidity / 1_000, 35) + (locked ? 20 : 0))));
  return (
    <section className="panel p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-edge pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-black text-mute">Liquidity Management</div>
          <div className="mt-1 text-xl font-black text-ink">{health}/100 Pool Health</div>
        </div>
        <LockKeyhole size={18} className={locked ? "text-neon" : "text-amber"} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Liquidity" value={formatDisplayFiat(liquidity, 0)} />
        <MiniMetric label="Lock" value={locked ? "Locked" : "Pending"} />
        <MiniMetric label="Pool" value={short(coin.poolId || coin.pool_id)} />
        <MiniMetric label="Route" value={liquidity > 0 ? "Tradable" : "Waiting"} />
      </div>
      {isOwner ? (
        <Link href="/artist" className="btn w-full h-10 text-[10px] uppercase tracking-widest font-black">Manage Artist Dashboard</Link>
      ) : (
        <div className="rounded-xl border border-edge bg-panel2 p-3 text-xs text-mute">Only the issuing artist can manage future liquidity actions.</div>
      )}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3 min-w-0">
      <div className="text-[9px] uppercase tracking-widest font-black text-mute">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-ink">{value}</div>
    </div>
  );
}

export function MarketIntelligenceGrid({ coin, isOwner }: { coin: AudiusCoin & Record<string, any>; isOwner?: boolean }) {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <MarketDepthPanel coin={coin} />
      <ActivityRiskPanel coin={coin} />
      <TokenAlertsPanel coin={coin} />
      <LiquidityManagementPanel coin={coin} isOwner={isOwner} />
    </section>
  );
}
