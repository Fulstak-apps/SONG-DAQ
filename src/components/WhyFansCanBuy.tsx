"use client";

import { Coins, Lock, TrendingUp } from "lucide-react";

export function WhyFansCanBuy({ compact = false }: { compact?: boolean }) {
  const items = [
    {
      icon: <TrendingUp size={14} />,
      title: "Fans buy from the market",
      body: "The public allocation sits in a curve or liquidity pool. Buyers trade against that market instead of a hidden artist wallet.",
    },
    {
      icon: <Lock size={14} />,
      title: "Artist share is separate",
      body: "The artist portion is separate from the public pool and should vest over time instead of being freely dumped at launch.",
    },
    {
      icon: <Coins size={14} />,
      title: "Liquidity makes it tradable",
      body: "Launch liquidity pairs song coins with SOL, USDC, or AUDIO-style market depth so people can buy and sell through the pool.",
    },
  ];
  if (compact) {
    return (
      <div className="min-w-0 max-w-full rounded-2xl border border-neon/20 bg-neon/8 p-4 text-neon">
        <div className="text-[10px] font-black uppercase tracking-[0.18em]">Why fans can buy</div>
        <p className="mt-2 text-xs leading-relaxed text-neon/78">
          Artist hold is separate. Public allocation plus liquidity creates the market fans trade against.
        </p>
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.title} className="flex min-w-0 items-start gap-2 rounded-xl border border-neon/12 bg-black/15 p-2.5">
              <span className="mt-0.5 shrink-0 text-neon">{item.icon}</span>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.04em] text-neon">{item.title}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-neon/68">{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-neon/20 bg-neon/8 p-5 text-neon">
      <div className="text-[10px] uppercase tracking-[0.18em] font-black">Why fans can buy</div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neon/80 sm:text-base">
        Artists do not sell every coin straight from their wallet. Part of the supply goes into a public market pool, the artist share stays separate, and liquidity is what lets fans buy and sell.
        <span className="block pt-1 text-neon/65">Price movement depends on demand, liquidity depth, and real trading activity.</span>
      </p>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="min-w-0 max-w-full overflow-hidden rounded-xl border border-neon/15 bg-black/15 p-3.5">
            <div className="flex min-w-0 items-start gap-2 text-[11px] uppercase tracking-[0.04em] font-black leading-snug text-neon">
              <span className="mt-0.5 shrink-0">{item.icon}</span>
              <span className="min-w-0 whitespace-normal break-words">{item.title}</span>
            </div>
            <div className="mt-2 max-w-full text-[12px] leading-relaxed text-neon/72 sm:text-[13px]">{item.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
