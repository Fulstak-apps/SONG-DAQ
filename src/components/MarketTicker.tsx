"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtSol } from "@/lib/pricing";
import { useCoins } from "@/lib/useCoins";

interface CoinTick {
  kind: "coin";
  symbol: string;
  href: string;
  priceUsd: number;
  change: number;
}
interface SongTick {
  kind: "song";
  symbol: string;
  href: string;
  priceSol: number;
  change: number;
}
interface NewsTick {
  kind: "news";
  category: "TECH" | "MUSIC" | "TRENDING";
  title: string;
  link: string;
  source: string;
}

type Tick = CoinTick | SongTick | NewsTick;

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
  const [songs, setSongs] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    const loadSongs = () =>
      fetch("/api/songs?sort=volume", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => { if (alive) setSongs(j.songs ?? []); })
        .catch(() => {});
    const loadNews = () =>
      fetch("/api/news", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => { if (alive) setNews(j.news ?? []); })
        .catch(() => {});
    loadSongs(); loadNews();
    const sI = setInterval(loadSongs, 30_000);
    const nI = setInterval(loadNews, 5 * 60_000);
    return () => { alive = false; clearInterval(sI); clearInterval(nI); };
  }, []);

  const ticks = useMemo<Tick[]>(() => {
    const coinTicks: CoinTick[] = coins.slice(0, 30).map((c) => ({
      kind: "coin",
      symbol: c.ticker,
      href: `/coin/${c.mint}`,
      priceUsd: c.price ?? 0,
      change: c.priceChange24hPercent ?? 0,
    }));
    const songTicks: SongTick[] = (songs ?? []).slice(0, 16).map((s: any) => ({
      kind: "song",
      symbol: s.symbol,
      href: `/song/${s.id}`,
      priceSol: s.price,
      change: (s.performance - 1) * 100,
    }));
    const newsTicks: NewsTick[] = (news ?? []).slice(0, 14).map((n: any) => ({
      kind: "news",
      category: n.category,
      title: String(n.title ?? "").slice(0, 120),
      link: n.link ?? "#",
      source: n.source ?? "",
    }));

    const mixed: Tick[] = [];
    let ci = 0, si = 0, ni = 0;
    while (ci < coinTicks.length || si < songTicks.length || ni < newsTicks.length) {
      for (let k = 0; k < 4 && ci < coinTicks.length; k++) mixed.push(coinTicks[ci++]);
      if (ni < newsTicks.length) mixed.push(newsTicks[ni++]);
      for (let k = 0; k < 2 && si < songTicks.length; k++) mixed.push(songTicks[si++]);
      if (ni < newsTicks.length) mixed.push(newsTicks[ni++]);
    }
    return mixed;
  }, [coins, songs, news]);

  if (!ticks.length) {
    return (
      <div className="ticker-wrap py-2 text-[10px] uppercase tracking-widest font-bold text-white/15 text-center bg-bg/80 border-b border-white/[0.03] backdrop-blur-xl">
        <span className="animate-pulse">Loading market intelligence…</span>
      </div>
    );
  }
  const doubled = [...ticks, ...ticks];
  return (
    <div className="ticker-wrap bg-bg/60 border-b border-white/[0.03] backdrop-blur-xl relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />
      
      <div className="flex animate-ticker py-2 whitespace-nowrap items-center">
        {doubled.map((t, i) => {
          if (t.kind === "coin") {
            return (
              <Link key={`c${i}`} href={t.href} className="px-5 text-[11px] flex items-center gap-2 hover:bg-white/[0.02] transition rounded-lg group">
                <span className="font-mono font-bold text-white/25 group-hover:text-white/60 transition">${t.symbol}</span>
                <span className="num font-bold text-white/60">{fmtUsd(t.priceUsd)}</span>
                <span className={`num font-bold tracking-wider ${t.change >= 0 ? "text-neon/70" : "text-red/70"}`}>
                  {t.change >= 0 ? "▲" : "▼"} {Math.abs(t.change).toFixed(2)}%
                </span>
                <span className="text-white/[0.04] ml-3">│</span>
              </Link>
            );
          }
          if (t.kind === "song") {
            return (
              <Link key={`s${i}`} href={t.href} className="px-5 text-[11px] flex items-center gap-2 hover:bg-white/[0.02] transition rounded-lg group">
                <span className="font-mono font-bold text-white/25 group-hover:text-white/60 transition">♪ {t.symbol}</span>
                <span className="num font-bold text-white/60">{fmtSol(t.priceSol, 5)}</span>
                <span className={`num font-bold tracking-wider ${t.change >= 0 ? "text-neon/70" : "text-red/70"}`}>
                  {t.change >= 0 ? "▲" : "▼"} {Math.abs(t.change).toFixed(2)}%
                </span>
                <span className="text-white/[0.04] ml-3">│</span>
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
              className="px-5 text-[11px] flex items-center gap-2 hover:bg-white/[0.02] transition rounded-lg group max-w-[480px] truncate"
            >
              <span className={`px-1.5 py-0.5 rounded border font-mono uppercase tracking-widest text-[8px] font-black ${CAT_COLOR[t.category] ?? "text-white/20 border-white/[0.04] bg-white/[0.02]"}`}>
                {t.category}
              </span>
              <span className="text-white/40 font-medium group-hover:text-white/70 transition truncate">{t.title}</span>
              <span className="text-white/15 uppercase tracking-widest font-bold text-[9px]">· {t.source}</span>
              <span className="text-white/[0.04] ml-3">│</span>
            </Cmp>
          );
        })}
      </div>
    </div>
  );
}
