"use client";

import { Coins, Lock, TrendingUp } from "lucide-react";

export function WhyFansCanBuy({ compact = false }: { compact?: boolean }) {
  const items = [
    {
      icon: <TrendingUp size={14} />,
      title: "Fans buy from the market",
      body: "The public allocation sits in a curve or liquidity pool. Buyers trade against that market, not a hidden artist wallet.",
    },
    {
      icon: <Lock size={14} />,
      title: "Artist allocation vests",
      body: "The artist portion is separate and should vest over time so the artist cannot instantly dump the whole supply.",
    },
    {
      icon: <Coins size={14} />,
      title: "Liquidity makes it tradable",
      body: "Launch liquidity pairs song coins with SOL, USDC, or AUDIO-style market depth so people can buy and sell.",
    },
  ];
  return (
    <section className={`rounded-2xl border border-neon/20 bg-neon/8 ${compact ? "p-4" : "p-5"} text-neon`}>
      <div className="text-[10px] uppercase tracking-widest font-black">Why fans can buy</div>
      <p className="mt-2 text-xs leading-relaxed text-neon/80">
        SONG·DAQ follows the Open Audio/Audius idea: artist vesting is separate from the public market. Fans can profit only if demand and liquidity support a higher market price. Profit is not guaranteed.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-xl border border-neon/15 bg-black/15 p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-neon">
              {item.icon} {item.title}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-neon/75">{item.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
