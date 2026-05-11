"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCoins } from "@/lib/useCoins";

interface CoinTick {
  kind: "coin";
  symbol: string;
  href: string;
  priceUsd: number;
  change: number;
}
interface NewsTick {
  kind: "news";
  category: "TECH" | "MUSIC" | "TRENDING";
  title: string;
  link: string;
  source: string;
}

type Tick = CoinTick | NewsTick;

function fmtUsd(n: number) {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(6)}`;
}

const CAT_COLOR: Record<string, string> = {
  TECH: "text-cyan bg-cyan/5 border-cyan/15",
  MUSIC: "text-violet bg-violet/5 border-violet/15",
  TRENDING: "text-neon bg-neon/5 border-neon/15",
};

export function MarketTicker() {
  const { coins } = useCoins("volume");
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

  if (!ticks.length) {
    return (
      <div className="ticker-wrap py-2 text-[10px] uppercase tracking-widest font-bold text-mute text-center bg-bg/90 border-b border-edge backdrop-blur-xl">
        <span className="animate-pulse">Loading market intelligence…</span>
      </div>
    );
  }
  const doubled = [...ticks, ...ticks];
  return (
    <div className="ticker-wrap bg-bg/90 border-b border-edge backdrop-blur-xl relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />
      
      <div className="flex animate-ticker py-2 pl-2 pr-2 whitespace-nowrap items-center" style={{ animationDuration: "74s" }}>
        {doubled.map((t, i) => {
          if (t.kind === "coin") {
            return (
              <Link key={`c${i}`} href={t.href} className="mx-0.5 flex w-[188px] sm:w-[248px] shrink-0 items-center gap-1 overflow-hidden rounded-lg px-2 text-[10px] transition hover:bg-white/[0.05] sm:gap-1.5 sm:px-2.5 sm:text-[11px] group">
                <span className="font-mono font-black text-ink group-hover:text-neon transition truncate max-w-[76px] sm:max-w-[110px]">${t.symbol}</span>
                <span className="num font-bold text-ink shrink-0 tabular-nums">{fmtUsd(t.priceUsd)}</span>
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
              className="mx-0.5 flex w-[260px] max-w-[calc(100vw-2rem)] shrink-0 items-center gap-1 overflow-hidden rounded-lg px-2 text-[10px] transition hover:bg-white/[0.05] sm:w-[340px] lg:w-[380px] sm:gap-1.5 sm:px-2.5 sm:text-[11px] group"
            >
              <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest ${CAT_COLOR[t.category] ?? "text-mute border-edge bg-panel"}`}>
                {t.category}
              </span>
              <span className="block min-w-0 flex-1 truncate font-semibold text-ink transition group-hover:text-neon">{t.title}</span>
              <span className="hidden max-w-[120px] shrink-0 truncate text-[9px] font-bold uppercase tracking-widest text-mute sm:block">· {t.source}</span>
              <span className="text-mute/70 ml-0.5 shrink-0">│</span>
            </Cmp>
          );
        })}
      </div>
    </div>
  );
}
