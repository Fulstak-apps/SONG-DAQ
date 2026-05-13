"use client";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCoins } from "@/lib/useCoins";
import { useUsdToDisplayRate } from "@/lib/fiat";

interface CoinTick {
  kind: "coin";
  symbol: string;
  href: string;
  priceUsd: number;
  change: number;
}
interface NewsTick {
  kind: "news";
  category: "TECH" | "MUSIC" | "AI" | "CREATOR" | "TRENDING";
  title: string;
  link: string;
  source: string;
}

type Tick = CoinTick | NewsTick;

const CAT_COLOR: Record<string, string> = {
  TECH: "text-cyan bg-cyan/5 border-cyan/15",
  MUSIC: "text-violet bg-violet/5 border-violet/15",
  AI: "text-gold bg-gold/5 border-gold/15",
  CREATOR: "text-neon bg-neon/5 border-neon/15",
  TRENDING: "text-neon bg-neon/5 border-neon/15",
};

const SYNCING_TICKS: NewsTick[] = [
  {
    kind: "news",
    category: "TRENDING",
    title: "Syncing live song coin, artist coin, and Open Audio market data",
    link: "/market",
    source: "song-daq",
  },
  {
    kind: "news",
    category: "MUSIC",
    title: "Music news and creator market intelligence are loading",
    link: "/social",
    source: "song-daq",
  },
  {
    kind: "news",
    category: "TECH",
    title: "Wallet, liquidity, and price feeds are refreshing",
    link: "/portfolio",
    source: "song-daq",
  },
];

export function MarketTicker() {
  const { coins } = useCoins("volume");
  const { formatUsd: formatDisplayFiat } = useUsdToDisplayRate();
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    const loadNews = () =>
      fetch("/api/news", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => { if (alive) setNews(j.news ?? []); })
        .catch(() => {});
    loadNews();
    const nI = setInterval(loadNews, 5 * 60_000);
    return () => { alive = false; clearInterval(nI); };
  }, []);

  const ticks = useMemo<Tick[]>(() => {
    const coinTicks: CoinTick[] = coins.slice(0, 30).map((c) => ({
      kind: "coin",
      symbol: c.ticker,
      href: `/coin/${c.mint}`,
      priceUsd: c.price ?? 0,
      change: c.priceChange24hPercent ?? 0,
    }));
    const newsTicks: NewsTick[] = (news ?? []).slice(0, 18).map((n: any) => ({
      kind: "news",
      category: n.category,
      title: String(n.title ?? "").slice(0, 150),
      link: n.link ?? "#",
      source: n.source ?? "",
    }));

    const mixed: Tick[] = [];
    let ci = 0, ni = 0;
    while (ci < coinTicks.length || ni < newsTicks.length) {
      for (let k = 0; k < 3 && ci < coinTicks.length; k++) mixed.push(coinTicks[ci++]);
      if (ni < newsTicks.length) mixed.push(newsTicks[ni++]);
      if (ni < newsTicks.length) mixed.push(newsTicks[ni++]);
    }
    return mixed;
  }, [coins, news]);

  const displayTicks: Tick[] = ticks.length ? ticks : SYNCING_TICKS;
  const doubled = [...displayTicks, ...displayTicks, ...displayTicks];
  return (
    <div className="ticker-wrap bg-bg/90 border-b border-edge backdrop-blur-xl relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />
      
      <div
        className="ticker-track flex py-2 pl-2 pr-2 whitespace-nowrap items-center hover:[animation-play-state:paused]"
        style={{ "--ticker-duration": ticks.length ? "150s" : "70s" } as CSSProperties}
      >
        {doubled.map((t, i) => {
          if (t.kind === "coin") {
            return (
              <Link key={`c${i}`} href={t.href} className="mx-0.5 flex w-[198px] sm:w-[258px] shrink-0 items-center gap-1 overflow-hidden rounded-lg px-2 text-[11px] transition hover:bg-white/[0.05] sm:gap-1.5 sm:px-2.5 sm:text-xs group">
                <span className="font-mono font-black text-ink group-hover:text-neon transition truncate max-w-[76px] sm:max-w-[110px]">${t.symbol}</span>
                <span className="num font-bold text-ink shrink-0 tabular-nums">{formatDisplayFiat(t.priceUsd, Math.abs(t.priceUsd) >= 1 ? 2 : 6)}</span>
                <span className={`num font-black tracking-wider shrink-0 ${t.change >= 0 ? "text-neon animate-pulse" : "text-red"}`}>
                  {t.change >= 0 ? "▲" : "▼"} {Math.abs(t.change).toFixed(2)}%
                </span>
                <span className="text-mute/70 ml-0.5 shrink-0">│</span>
              </Link>
            );
          }
          // news
          const isExternal = t.link.startsWith("http");
          const Cmp: any = isExternal ? "a" : Link;
          const props = isExternal
            ? { href: t.link, target: "_blank", rel: "noreferrer" }
            : { href: t.link };
          return (
            <Cmp
              key={`n${i}`}
              {...props}
              className="mx-0.5 flex w-[280px] max-w-[calc(100vw-2rem)] shrink-0 items-center gap-1 overflow-hidden rounded-lg px-2 text-[11px] transition hover:bg-white/[0.05] sm:w-[360px] lg:w-[400px] sm:gap-1.5 sm:px-2.5 sm:text-xs group"
            >
              <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] font-black uppercase tracking-widest ${CAT_COLOR[t.category] ?? "text-mute border-edge bg-panel"}`}>
                {t.category}
              </span>
              <span className="block min-w-0 flex-1 truncate font-semibold text-ink transition group-hover:text-neon">{t.title}</span>
              <span className="hidden max-w-[120px] shrink-0 truncate text-[11px] font-bold uppercase tracking-widest text-mute sm:block">· {t.source}</span>
              <span className="text-mute/70 ml-0.5 shrink-0">│</span>
            </Cmp>
          );
        })}
      </div>
    </div>
  );
}
