"use client";

import Link from "next/link";
import { HypeMeterCard, SongIPOPanel, UndervaluedSignalsPanel } from "@/components/GamificationLayer";
import { CardGridSkeleton, StatRowSkeleton } from "@/components/Skeleton";
import { useCoins } from "@/lib/useCoins";
import { usePaperTrading } from "@/lib/store";
import { getHypeScore } from "@/lib/gamification";
import { ArrowRight, Radar, Sparkles } from "lucide-react";

const DEMO_SIGNAL_ASSETS = [
  {
    id: "demo-velvet-rush",
    mint: "demo-velvet-rush",
    ticker: "VELVET",
    title: "Velvet Rush",
    name: "Velvet Rush",
    artistName: "Nova Saint",
    artist_name: "Nova Saint",
    price: 0.000018,
    marketCap: 18_000,
    v24hUSD: 1450,
    holder: 84,
    priceChange24hPercent: 12.4,
    totalSupply: 1_000_000_000,
    royaltyPercentageCommitted: 12,
  },
  {
    id: "demo-midnight-loop",
    mint: "demo-midnight-loop",
    ticker: "LOOP",
    title: "Midnight Loop",
    name: "Midnight Loop",
    artistName: "Kairo Lane",
    artist_name: "Kairo Lane",
    price: 0.000009,
    marketCap: 9_000,
    v24hUSD: 820,
    holder: 42,
    priceChange24hPercent: 6.8,
    totalSupply: 1_000_000_000,
    royaltyPercentageCommitted: 10,
  },
  {
    id: "demo-silver-static",
    mint: "demo-silver-static",
    ticker: "STATIC",
    title: "Silver Static",
    name: "Silver Static",
    artistName: "Inez Grey",
    artist_name: "Inez Grey",
    price: 0.000031,
    marketCap: 31_000,
    v24hUSD: 2360,
    holder: 129,
    priceChange24hPercent: 18.2,
    totalSupply: 1_000_000_000,
    royaltyPercentageCommitted: 15,
  },
];

export function GamifiedSignalsPage() {
  const { coins, loading } = useCoins("quality");
  const paperMode = usePaperTrading((s) => s.enabled);
  const signalAssets = coins.length ? coins : DEMO_SIGNAL_ASSETS;
  const topHype = [...signalAssets]
    .sort((a, b) => getHypeScore(b as any).score - getHypeScore(a as any).score)
    .slice(0, 3);

  return (
    <main className="space-y-6 pb-14">
      <section className="panel-elevated grain overflow-hidden p-5 sm:p-7 lg:p-9">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon/25 bg-neon/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-neon">
              <Radar size={13} /> Music Investing Signals
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl lg:text-5xl">
              Hype, IPOs, and undervalued picks.
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {paperMode && (
              <span className="rounded-full border border-neon/30 bg-neon/12 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-neon">
                Paper Mode Active
              </span>
            )}
            {loading && (
              <span className="rounded-full border border-edge bg-white/[0.055] px-3 py-2 text-[11px] font-black uppercase tracking-widest text-mute">
                Live data syncing
              </span>
            )}
            <Link href="/market" className="btn-primary h-11 px-4 text-[11px] font-black uppercase tracking-widest">
              Back to Market <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {loading && !coins.length ? (
        <div className="space-y-5">
          <StatRowSkeleton />
          <CardGridSkeleton count={3} />
        </div>
      ) : null}

      {
        <>
          <section className="grid gap-4 xl:grid-cols-3">
            {(topHype.length ? topHype : signalAssets.slice(0, 3)).map((coin) => (
              <HypeMeterCard key={(coin as any).mint || (coin as any).id || (coin as any).ticker} asset={coin as any} compact />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <SongIPOPanel assets={signalAssets as any[]} limit={3} />
            <UndervaluedSignalsPanel assets={signalAssets as any[]} limit={3} />
          </section>

          <UndervaluedSignalsPanel assets={signalAssets as any[]} limit={6} />

          <section className="panel-elevated grain p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-violet/25 bg-violet/10 text-violet">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-lg font-black text-ink">How to use Signals</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-mute">
                  Signals help you discover movement before it is obvious: rising Hype Meter scores, launch events, and songs that may be undernoticed. They are discovery tools, not financial advice.
                </p>
              </div>
            </div>
          </section>
        </>
      }
    </main>
  );
}
