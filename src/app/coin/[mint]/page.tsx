"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SafeImage } from "@/components/SafeImage";
import { Sparkline } from "@/components/Sparkline";
import { usePlayer, useSession, type PlayerTrack } from "@/lib/store";
import { CoinTradeModal } from "@/components/CoinTradeModal";
import { MarketSafetyPanel, RiskBadge } from "@/components/RiskBadge";
import { ReportModal } from "@/components/ReportModal";
import { PriceChart, type PricePointDTO } from "@/components/PriceChart";
import { TradeFeed } from "@/components/TradeFeed";
import { MarketIntelligenceGrid } from "@/components/MarketIntelligence";
import { useCoinWatchlist, useRecentCoins } from "@/lib/coinWatchlist";
import { ChartSkeleton } from "@/components/Skeleton";
import { useCoins } from "@/lib/useCoins";
import { fmtNum, fmtPct } from "@/lib/pricing";
import type { AudiusCoin } from "@/lib/audiusCoins";
import { Glossary, InfoTooltip } from "@/components/Tooltip";
import { readJson } from "@/lib/safeJson";

import { CHART_RANGE_LABELS, CHART_RANGES, CHART_RANGE_MS, isFastRange, type ChartRange } from "@/lib/chartRanges";

function fmtUsd(n: number, d = 4) {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(d)}`;
}

function shortMint(m: string) {
  return m.length > 14 ? `${m.slice(0, 6)}…${m.slice(-4)}` : m;
}

export default function CoinPage() {
  const { mint } = useParams<{ mint: string }>();
  const { audius } = useSession();
  const { current, playing, playTrack, toggle } = usePlayer();
  const [coin, setCoin] = useState<AudiusCoin | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tradeSide, setTradeSide] = useState<"BUY" | "SELL" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [points, setPoints] = useState<PricePointDTO[]>([]);
  const [range, setRange] = useState<ChartRange>("LIVE");
  const [chartType, setChartType] = useState<"line" | "candles">("line");
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const advancedMode = true;
  const { coins: allCoins } = useCoins("marketCap");
  const [search, setSearch] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);

  const { mints: watched, toggle: toggleWatch, has: isWatched } = useCoinWatchlist();
  const { mints: recent, push: pushRecent } = useRecentCoins();

  // Track recently viewed mints (for tab bar).
  useEffect(() => { if (mint) pushRecent(String(mint)); }, [mint, pushRecent]);

  const load = useCallback(async () => {
    try {
      const [coinR, histR] = await Promise.all([
        fetch(`/api/coins/${mint}`, { cache: "no-store" }),
        fetch(`/api/coins/${mint}/history?range=${range}`, { cache: "no-store" }),
      ]);
      const cj = await readJson<{ coin?: AudiusCoin; error?: string }>(coinR);
      if (!coinR.ok) throw new Error(cj?.error || "Could not load this coin.");
      setCoin(cj?.coin ?? null);
      if (histR.ok) {
        const hj = await readJson<{ candles?: PricePointDTO[] }>(histR);
        setPoints(hj?.candles ?? []);
      }
    } catch (e: any) { setErr(e.message); }
  }, [mint, range]);

  useEffect(() => {
    load();
    const fast = isFastRange(range);
    const i = setInterval(load, fast ? 1_000 : 6_000);
    return () => clearInterval(i);
  }, [load, range]);

  // Fetch a few of the artist's tracks for the "news" panel.
  useEffect(() => {
    if (!coin?.artist_handle) { setTracks([]); return; }
    let alive = true;
    fetch(`/api/audius/tracks?handle=${encodeURIComponent(coin.artist_handle)}`, { cache: "no-store" })
      .then((r) => r.ok ? readJson<{ tracks?: any[] }>(r) : { tracks: [] })
      .then((j) => { if (alive) setTracks(j?.tracks ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [coin?.artist_handle]);

  const watchlistCoins = useMemo(() => {
    const seen = new Set<string>();
    const list: AudiusCoin[] = [];
    for (const m of watched) {
      const c = allCoins.find((x) => x.mint === m);
      if (c && !seen.has(c.mint)) { list.push(c); seen.add(c.mint); }
    }
    return list;
  }, [watched, allCoins]);

  const tabCoins = useMemo(() => {
    const ids = Array.from(new Set([String(mint), ...recent])).slice(0, 6);
    return ids
      .map((m) => allCoins.find((c) => c.mint === m))
      .filter(Boolean) as AudiusCoin[];
  }, [mint, recent, allCoins]);

  // Filter chart points by range.
  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = now - (CHART_RANGE_MS[range] || CHART_RANGE_MS.LIVE);
    
    // 1. Filter existing points
    let res = points.filter((x) => new Date(x.ts as any).getTime() >= cutoff);

    // 2. Add the current indexed price as the latest real-time point.
    if (coin) {
      const livePrice = coin.price ?? 0;
      const livePoint = { 
        ts: new Date(), 
        open: livePrice, 
        high: livePrice, 
        low: livePrice, 
        close: livePrice, 
        volume: 0 
      } as any;

      res.push(livePoint);
    }
    
    return res;
  }, [points, range, coin]);

  const sidebarItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? allCoins.filter((c) =>
          c.ticker?.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q) ||
          c.artist_name?.toLowerCase().includes(q) ||
          c.artist_handle?.toLowerCase().includes(q),
        )
      : (watchlistCoins.length ? watchlistCoins : allCoins.slice(0, 12));
    return base.slice(0, 25);
  }, [search, watchlistCoins, allCoins]);

  if (err) return <div className="panel p-10 text-center text-red uppercase tracking-widest font-bold shadow-2xl">{err}</div>;
  if (!coin) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="panel p-4 space-y-3 hidden lg:block bg-panel border border-edge">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 bg-white/10 animate-pulse rounded" />
                <div className="h-2 w-24 bg-white/5 animate-pulse rounded" />
              </div>
              <div className="h-3 w-12 bg-white/10 animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="panel p-6 flex gap-6 bg-panel border border-edge">
            <div className="w-24 h-24 rounded-xl bg-white/5 animate-pulse" />
            <div className="flex-1 space-y-4">
              <div className="h-8 w-48 bg-white/10 animate-pulse rounded" />
              <div className="h-4 w-64 bg-white/5 animate-pulse rounded" />
              <div className="h-10 w-40 bg-white/10 animate-pulse rounded mt-4" />
            </div>
          </div>
          <ChartSkeleton height={380} />
        </div>
      </div>
    );
  }

  const change = coin.priceChange24hPercent ?? 0;
  const isOwner = !!(audius && audius.userId === coin.owner_id);
  const watching = isWatched(coin.mint);
  const livePrice = coin.price ?? 0;
  const histPrice = (coin as any).history24hPrice ?? livePrice;
  const high24 = Math.max(livePrice, histPrice);
  const low24 = Math.min(livePrice, histPrice);
  const dyn = (coin as any).dynamicBondingCurve ?? {};
  const locker = (coin as any).artist_locker ?? {};
  const reward = (coin as any).reward_pool ?? {};

  const modal = (
    <AnimatePresence>
      {tradeSide && (
        <CoinTradeModal
          coin={coin}
          side={tradeSide}
          onClose={() => setTradeSide(null)}
          onDone={() => setTradeSide(null)}
        />
      )}
    </AnimatePresence>
  );

  if (advancedMode) {
    return (
      <div className="fixed inset-0 z-[100] bg-bg text-ink flex flex-col font-sans overflow-y-auto lg:overflow-hidden">
        {/* Top Navbar */}
        <div className="min-h-16 border-b border-edge flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 shrink-0 bg-bg shadow-md z-10">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            {coin.logo_uri ? <SafeImage src={coin.logo_uri} alt={coin.ticker} width={36} height={36} fallback={coin.ticker} className="rounded-md shadow-sm" /> : <div className="w-9 h-9 rounded-md bg-white/10" />}
            <div className="flex items-center gap-3">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white break-words">${coin.ticker}</h1>
              {coin.artist_name ? <span className="text-sm font-bold text-white/80 break-words">{coin.artist_name}</span> : null}
            </div>
            <div className="w-px h-6 bg-white/10 mx-1 sm:mx-2 hidden sm:block" />
            <div className="flex items-baseline gap-2 sm:gap-3">
              <span className="text-lg sm:text-xl font-mono font-bold text-white">{fmtUsd(livePrice, 6)}</span>
              <span className={`num text-sm font-bold tracking-wider ${change >= 0 ? "gain" : "lose"}`}>
                {change >= 0 ? "+" : ""}{change.toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-3 sm:gap-4 sm:ml-6 text-xs text-mute font-mono">
              <div>MC: <span className="text-white">${fmtNum(coin.marketCap ?? 0)}</span></div>
              <div>Vol: <span className="text-white">${fmtNum((coin.marketCap ?? 0) * 0.14)}</span></div>
            </div>
          </div>
          
          <Link
            href="/market"
            className="px-3 sm:px-4 py-2 bg-red/10 text-red border border-red/20 hover:bg-red/20 transition-all rounded-md text-[10px] uppercase tracking-widest font-bold shadow-sm flex items-center gap-2"
          >
            <span>Back to Market</span>
            <span className="text-lg leading-none">&times;</span>
          </Link>
        </div>

        {/* Main Terminal Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden">
          
          {/* Left Sidebar (Watchlist) */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-edge flex flex-col bg-panel2 overflow-y-auto no-scrollbar shrink-0 max-h-[34dvh] lg:max-h-none">
            <div className="p-3 border-b border-edge bg-panel">
              <div className="text-[10px] uppercase tracking-widest font-bold text-mute">Market Watch</div>
            </div>
            <ul className="divide-y divide-edge">
              {sidebarItems.map((c) => {
                const ch = c.priceChange24hPercent ?? 0;
                return (
                  <li key={c.mint}>
                    <Link href={`/coin/${c.mint}`} className="flex items-center justify-between px-4 py-3 hover:bg-panel active:scale-[0.99] transition-all group">
                      <div className="flex items-center gap-3">
                        <SafeImage src={c.logo_uri} width={24} height={24} alt={c.ticker} fallback={c.ticker} className="rounded-md" />
                        <span className="font-bold text-sm text-white group-hover:text-neon transition">${c.ticker}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs font-bold text-white">{fmtUsd(c.price ?? 0, 4)}</div>
                        <div className={`text-[9px] font-bold tracking-wider ${ch >= 0 ? "gain" : "lose"}`}>
                          {ch >= 0 ? "+" : ""}{ch.toFixed(2)}%
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          
          {/* Center (Chart) */}
          <div className="flex-1 flex flex-col min-w-0 bg-bg relative min-h-[420px] lg:min-h-0">
            <div className="absolute inset-0 bg-gradient-to-b from-neon/5 to-transparent pointer-events-none opacity-20" />
            
            <div className="border-b border-edge bg-panel relative z-10 px-4 py-2">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="text-[9px] uppercase tracking-widest font-black text-mute">Timeframe: <span className="text-neon">{CHART_RANGE_LABELS[range]}</span></div>
                <div className="ml-auto flex rounded-lg bg-white/[0.055] border border-edge p-0.5 text-[9px] font-black uppercase tracking-widest">
                  {(["line", "candles"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setChartType(mode)}
                      className={`px-2.5 py-1 rounded-md transition ${chartType === mode ? "bg-white/10 text-ink" : "text-mute hover:text-ink"}`}
                    >
                      {mode === "line" ? "Line" : "Candles"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {CHART_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 rounded text-[10px] uppercase tracking-widest font-bold transition-all shrink-0 ${range === r ? "bg-neon/15 text-neon border border-neon/25" : "text-mute hover:text-white hover:bg-white/10"}`}
                  >{r}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-4 relative z-10 min-h-[300px]">
              <PriceChart points={filtered} chartType={chartType} live={isFastRange(range)} mode="advanced" showVolume showMA7={false} showMA25={false} />
            </div>
          </div>

          {/* Right Sidebar (Trade Panel) */}
          <div className="w-full lg:w-[380px] border-t lg:border-t-0 lg:border-l border-edge bg-panel2 flex flex-col justify-center items-center shrink-0 p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="text-center space-y-2 mb-4">
              <div className="text-3xl font-mono font-bold text-white tracking-tighter">${coin.ticker}</div>
              <div className="text-[10px] text-mute uppercase tracking-widest font-bold">Trading Desk</div>
            </div>
            <button onClick={() => setTradeSide("BUY")} className="btn-primary w-full py-4 text-lg">BUY</button>
            <button onClick={() => setTradeSide("SELL")} className="btn-danger w-full py-4 text-lg">SELL</button>
          </div>

        </div>
        {modal}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 min-h-[80vh]">
      {/* ── SIDEBAR (watchlist) ───────────────────────────────────────── */}
      <aside className="panel order-2 lg:order-1 p-0 flex flex-col h-fit lg:sticky lg:top-24 border border-edge bg-panel2 shadow-2xl backdrop-blur-xl">
        <div className="p-4 border-b border-edge bg-panel">
          <input
            placeholder="Search Intelligence Database…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-panel2 border border-edge rounded-lg px-3 py-2 text-ink placeholder-mute focus:border-neon/50 focus:ring-1 focus:ring-neon/50 transition-all font-mono"
          />
        </div>
        <div className="px-4 py-3 flex items-center justify-between bg-panel">
          <div className="text-[10px] uppercase tracking-widest font-bold text-mute">{search ? "Search Results" : watchlistCoins.length ? "Active Tracking" : "Market Movers"}</div>
          <span className="text-[10px] font-mono font-bold text-mute">{sidebarItems.length}</span>
        </div>
        <ul className="divide-y divide-edge max-h-[65vh] overflow-y-auto">
          {sidebarItems.map((c) => {
            const ch = c.priceChange24hPercent ?? 0;
            const active = c.mint === mint;
            return (
              <li key={c.mint}>
                <Link
                  href={`/coin/${c.mint}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-panel active:scale-[0.99] transition-all group ${active ? "bg-neon/10 border-l-2 border-neon" : "border-l-2 border-transparent"}`}
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-panel2 border border-edge shrink-0 shadow-lg">
                    <SafeImage src={c.logo_uri} fill sizes="40px" alt={c.ticker} fallback={c.ticker} className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white tracking-wide truncate group-hover:text-neon transition">${c.ticker}</div>
                    <div className="text-[10px] uppercase tracking-widest text-mute truncate mt-0.5">{c.artist_name ?? c.name}</div>
                  </div>
                  <div className="w-14 h-8 shrink-0 opacity-80 group-hover:opacity-100 transition">
                    <Sparkline
                      data={c.sparkline?.length ? c.sparkline : [0, 0]}
                      color={ch >= 0 ? "#00E572" : "#FF3366"}
                    />
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-white">{fmtUsd(c.price ?? 0, 6)}</div>
                    <div className={`text-[9px] font-bold tracking-wider mt-1 ${ch >= 0 ? "gain drop-shadow-[0_0_5px_rgba(0,229,114,0.3)]" : "lose drop-shadow-[0_0_5px_rgba(255,51,102,0.3)]"}`}>
                      {ch >= 0 ? "+" : ""}{ch.toFixed(2)}%
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {!sidebarItems.length && (
            <li className="px-4 py-10 text-center text-mute text-[10px] uppercase tracking-widest font-bold">No Records Found</li>
          )}
        </ul>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────────── */}
      <div className="order-1 lg:order-2 space-y-6 min-w-0">
        {/* Tab bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabCoins.map((c) => {
            const active = c.mint === mint;
            return (
              <Link
                key={c.mint}
                href={`/coin/${c.mint}`}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${
                  active ? "bg-neon text-black shadow-[0_0_15px_rgba(0,229,114,0.25)]" : "text-mute border border-edge hover:text-white hover:bg-white/10"
                }`}
              >${c.ticker}</Link>
            );
          })}
          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block" />
          <button
            onClick={() => toggleWatch(coin.mint)}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-all shadow-md ${watching ? "bg-neon/20 text-neon border border-neon/30" : "bg-panel text-mute border border-edge hover:bg-panel2 hover:text-white"}`}
          >{watching ? "★ Active Tracking" : "☆ Track Asset"}</button>
          <button className="px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all shadow-lg bg-panel border border-edge text-ink hover:bg-panel2 hover:text-neon">
            Advanced
          </button>
        </div>

        {/* Header */}
        <header className="panel p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-neon/5 to-transparent pointer-events-none mix-blend-screen" />
          
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-edge bg-panel2 shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <SafeImage src={coin.logo_uri} fill sizes="112px" alt={coin.ticker} fallback={coin.ticker} className="object-cover" />
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-baseline gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-md break-words">${coin.ticker}</h1>
              <span className="text-mute text-sm tracking-wide break-words whitespace-normal">{coin.name}</span>
              <span className="text-[9px] uppercase tracking-widest font-bold text-neon bg-neon/10 px-2 py-0.5 rounded border border-neon/30 shadow-[0_0_5px_rgba(0,229,114,0.25)]">Artist Token</span>
              <RiskBadge coin={coin as any} compact />
              {isOwner && <span className="text-[9px] uppercase tracking-widest font-bold text-violet bg-violet/10 px-2 py-0.5 rounded border border-violet/30 shadow-[0_0_5px_rgba(155,81,224,0.3)]">Your Asset</span>}
              {(coin as any).has_discord && <span className="text-[9px] uppercase tracking-widest font-bold text-[#5865F2] bg-[#5865F2]/10 px-2 py-0.5 rounded border border-[#5865F2]/30">Discord Active</span>}
            </div>
            <div className="text-mute text-xs font-medium uppercase tracking-widest flex items-center gap-2">
              {coin.artist_name && (
                <>
                  <span className="text-mute">ISSUER:</span>
                  {coin.artist_handle
                    ? <a href={`https://audius.co/${coin.artist_handle}`} target="_blank" rel="noreferrer" className="text-white hover:text-neon transition">{coin.artist_name}</a>
                    : <span className="text-white">{coin.artist_name}</span>}
                  {coin.artist_handle ? <span className="font-mono text-mute">(@{coin.artist_handle})</span> : ""}
                </>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-3 flex-wrap pr-0 md:pr-4">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{fmtUsd(coin.price ?? 0, 6)}</span>
              <span className={`num text-lg font-bold tracking-wider ${change >= 0 ? "gain drop-shadow-[0_0_10px_rgba(0,229,114,0.4)]" : "lose drop-shadow-[0_0_10px_rgba(255,51,102,0.4)]"}`}>
                {change >= 0 ? "+" : ""}{fmtPct(change)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-mute font-bold">24H</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0 relative z-10 w-full md:w-44 md:self-stretch md:justify-center">
            <button className="btn-primary py-3 font-bold tracking-widest text-xs shadow-[0_0_20px_rgba(0,229,114,0.4)]" onClick={() => setTradeSide("BUY")}>EXECUTE BUY</button>
            <button className="bg-red/10 border border-red/30 text-red py-3 rounded-lg font-bold tracking-widest text-xs hover:bg-red/20 transition disabled:opacity-50" disabled={isOwner} onClick={() => setTradeSide("SELL")}>EXECUTE SELL</button>
            <button className="btn py-3 font-bold tracking-widest text-xs" onClick={() => setReportOpen(true)}>REPORT</button>
          </div>
        </header>

        {/* Chart */}
        <section className={`overflow-hidden border border-edge bg-black shadow-2xl ${
          chartFullscreen
            ? "fixed inset-2 z-[9999] rounded-[1.75rem] p-4 sm:inset-6 sm:p-6"
            : "relative rounded-[2rem] p-4 sm:p-6"
        }`}>
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-neon/35 to-transparent" />
          <div className="relative z-10 mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black tracking-widest text-mute">SONG·DAQ chart</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className="rounded-full bg-[#58d64f]/15 px-2 py-1 text-[#58d64f]">Live price</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-white/70">Advanced Chart</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setChartFullscreen((v) => !v)}
                className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/10"
              >
                {chartFullscreen ? "Close" : "Full"}
              </button>
            </div>
          </div>
          <div className={`relative z-10 ${chartFullscreen ? "h-[calc(100vh-230px)] min-h-[420px]" : "h-[330px] sm:h-[460px]"}`}>
            <PriceChart
              points={filtered}
              quote="USD"
              height={chartFullscreen ? 720 : 460}
              chartType={chartType}
              live={isFastRange(range)}
              showVolume
              showMA7={false}
              showMA25={false}
              mode="advanced"
              variant="investing"
            />
          </div>
          <div className="relative z-10 mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
              {CHART_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition-all sm:px-4 ${
                    range === r ? "bg-[#58d64f] text-black shadow-[0_0_20px_rgba(88,214,79,0.28)]" : "text-[#58d64f] hover:bg-[#58d64f]/10"
                  }`}
                >{r === "1MO" ? "1M" : r}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-mute">
                Timeframe: <span className="text-[#58d64f]">{CHART_RANGE_LABELS[range]}</span>
              </div>
              <div className="flex shrink-0 rounded-xl border border-white/10 bg-white/[0.045] p-1 text-[10px] font-black uppercase tracking-widest">
                {(["line", "candles"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setChartType(mode)}
                    className={`rounded-lg px-3 py-1.5 transition ${chartType === mode ? "bg-white/15 text-white" : "text-mute hover:text-white"}`}
                  >
                    {mode === "line" ? "Line" : "Candles"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        {coin.description && (
          <section className="panel p-6 shadow-xl">
            <div className="text-[10px] uppercase tracking-widest font-bold text-mute mb-3">Asset Intelligence Report</div>
            <p className="text-sm leading-relaxed text-white/80 font-medium">{coin.description}</p>
          </section>
        )}

        {/* News-style "tracks by artist" cards */}
        {!!tracks.length && (
          <section>
            <div className="text-[10px] uppercase tracking-widest font-bold text-mute mb-3 px-1">Issuer Discography</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tracks.slice(0, 4).map((t: any) => {
                const trackTitle = String(t.title ?? "");
                const trackId = String(t.id ?? "");
                const linkedCoin = allCoins.find((c) => {
                  const sameTrackId = String((c as any).audius_track_id ?? "") === trackId;
                  const sameTitle = String((c as any).audius_track_title ?? c.name ?? "").trim().toLowerCase() === trackTitle.trim().toLowerCase();
                  const sameArtist = !coin.artist_name || !c.artist_name || c.artist_name.toLowerCase() === coin.artist_name.toLowerCase();
                  return sameTrackId || (sameTitle && sameArtist);
                });
                const trackUrl = `https://audius.co/${coin.artist_handle}/${t.permalink ?? ""}`.replace(/\/+$/, "");
                const trackPlayer: PlayerTrack | null = trackId ? {
                  id: `audius-track-${trackId}`,
                  title: trackTitle,
                  artist: coin.artist_name ?? coin.name,
                  artwork: t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? null,
                  streamUrl: `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=songdaq`,
                  href: trackUrl,
                } : null;
                const isPlayingTrack = !!trackPlayer && current?.id === trackPlayer.id && playing;
                return (
                  <div
                    key={t.id}
                    className="panel p-4 flex flex-col gap-4 hover:bg-panel2 transition-all group shadow-lg border border-edge sm:flex-row"
                  >
                    <a
                      href={trackUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="relative w-16 h-16 rounded-lg overflow-hidden bg-panel2 border border-edge shrink-0 shadow-md"
                      title={`Open ${trackTitle} on Audius`}
                    >
                      <SafeImage
                        src={t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? null}
                        fill sizes="64px" alt={trackTitle} fallback={trackTitle} className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-bg/20 group-hover:bg-transparent transition-all" />
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <a href={trackUrl} target="_blank" rel="noreferrer" className="font-bold text-sm text-white break-words group-hover:text-neon transition">
                            {trackTitle}
                          </a>
                          <div className="text-[10px] uppercase tracking-widest text-mute whitespace-normal break-words mt-0.5">{coin.artist_name}</div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${
                          linkedCoin ? "border-neon/30 bg-neon/10 text-neon" : "border-edge bg-white/[0.04] text-mute"
                        }`}>
                          {linkedCoin ? "Coin On" : "No Coin"}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-mute mt-2 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1"><span className="text-neon">▶</span> {fmtNum(t.playCount ?? t.play_count ?? 0)}</span>
                        <span className="flex items-center gap-1"><span className="text-red">♥</span> {fmtNum(t.favoriteCount ?? t.favorite_count ?? 0)}</span>
                        <span className="flex items-center gap-1"><span className="text-violet">↻</span> {fmtNum(t.repostCount ?? t.repost_count ?? 0)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!trackPlayer) return;
                            if (current?.id === trackPlayer.id) toggle();
                            else playTrack(trackPlayer);
                          }}
                          className="btn-primary h-9 px-3 text-[9px] uppercase tracking-widest font-black"
                        >
                          {isPlayingTrack ? "Pause" : "Play"}
                        </button>
                        {linkedCoin ? (
                          <Link href={`/coin/${linkedCoin.mint}`} className="btn h-9 px-3 text-[9px] uppercase tracking-widest font-black">
                            Open Coin
                          </Link>
                        ) : (
                          <span className="inline-flex h-9 items-center rounded-xl border border-edge bg-panel2 px-3 text-[9px] uppercase tracking-widest font-black text-mute">
                            Coin Not On
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* On-chain breakdown */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="panel p-5 space-y-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-widest font-bold text-mute border-b border-edge pb-2">24h Network Activity</div>
            <KVrow k="Buy Volume" v={`${fmtNum(coin.buy24h ?? 0)} · ${fmtUsd((coin as any).vBuy24hUSD ?? 0, 0)}`} accent="gain" />
            <KVrow k="Sell Volume" v={`${fmtNum(coin.sell24h ?? 0)} · ${fmtUsd((coin as any).vSell24hUSD ?? 0, 0)}`} accent="lose" />
            <KVrow k="Unique Wallets" v={fmtNum(coin.uniqueWallet24h ?? 0)} />
            <KVrow k="Trade Velocity Δ" v={`${((coin as any).trade24hChangePercent ?? 0).toFixed(1)}%`} />
          </div>
          <div className="panel p-5 space-y-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-widest font-bold text-mute border-b border-edge pb-2">
              <Glossary term="Locker" def="Tokens allocated to the artist, securely vested to prevent market dumping.">Artist Vesting Protocol</Glossary>
            </div>
            <KVrow k="Locked Supply" v={fmtNum((locker.locked ?? 0) / 1e9)} />
            <KVrow k="Vested Supply" v={fmtNum((locker.unlocked ?? 0) / 1e9)} />
            <KVrow k="Liquid Claimable" v={fmtNum((locker.claimable ?? 0) / 1e9)} accent="gain" />
            {locker.address && <KVrow k="Contract" v={shortMint(locker.address)} />}
          </div>
          <div className="panel p-5 space-y-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-widest font-bold text-mute border-b border-edge pb-2">
              <Glossary term="Reward Pool" def="Trading fees automatically collected and held for artist payout.">Fee Collection Vault</Glossary>
            </div>
            <KVrow k="Vault TVL" v={fmtNum((reward.balance ?? 0) / 1e9)} />
            <KVrow k="Lifetime Fees" v={fmtNum(((coin as any).artist_fees?.total_fees ?? 0) / 1e9)} />
            <KVrow k="Pending Claim" v={fmtNum(((coin as any).artist_fees?.unclaimed_fees ?? 0) / 1e9)} accent="gain" />
            {reward.address && <KVrow k="Contract" v={shortMint(reward.address)} />}
          </div>
        </section>

        {/* Mint + links */}
        <section className="panel p-5 shadow-xl space-y-4 bg-gradient-to-r from-panel2 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-bold text-mute">Solana Network Mint</span>
            <button
              className="text-[9px] uppercase tracking-widest font-bold px-3 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10 transition cursor-pointer text-white"
              onClick={() => navigator.clipboard.writeText(coin.mint)}
              title="Copy mint address"
            >Copy Identity</button>
          </div>
          <div className="font-mono text-xs text-ink break-all bg-panel2 p-3 rounded-lg border border-edge">{coin.mint}</div>
          <div className="flex flex-wrap gap-3 pt-2">
            <a className="text-[10px] font-bold tracking-widest uppercase text-ink hover:text-neon transition flex items-center gap-1 bg-panel2 px-3 py-1.5 rounded-lg border border-edge" href={`https://solscan.io/token/${coin.mint}`} target="_blank" rel="noreferrer">Solscan ↗</a>
            <a className="text-[10px] font-bold tracking-widest uppercase text-ink hover:text-neon transition flex items-center gap-1 bg-panel2 px-3 py-1.5 rounded-lg border border-edge" href={`https://birdeye.so/token/${coin.mint}?chain=solana`} target="_blank" rel="noreferrer">Birdeye ↗</a>
            <a className="text-[10px] font-bold tracking-widest uppercase text-ink hover:text-neon transition flex items-center gap-1 bg-panel2 px-3 py-1.5 rounded-lg border border-edge" href={`https://audius.co/clubs/${coin.ticker?.toLowerCase()}`} target="_blank" rel="noreferrer">Audius Clubs ↗</a>
            {coin.link_1 && <a className="text-[10px] font-bold tracking-widest uppercase text-ink hover:text-neon transition flex items-center gap-1 bg-panel2 px-3 py-1.5 rounded-lg border border-edge" href={coin.link_1} target="_blank" rel="noreferrer">External 1</a>}
            {coin.link_2 && <a className="text-[10px] font-bold tracking-widest uppercase text-ink hover:text-neon transition flex items-center gap-1 bg-panel2 px-3 py-1.5 rounded-lg border border-edge" href={coin.link_2} target="_blank" rel="noreferrer">External 2</a>}
          </div>
        </section>

        <RoyaltyTransparency coin={coin as any} />

        <section>
          <TradeFeed assetMint={coin.mint} detailMode />
        </section>
      </div>

      {tradeSide && (
        <CoinTradeModal coin={coin} side={tradeSide} onClose={() => setTradeSide(null)} onDone={load} />
      )}
      {reportOpen && <ReportModal mint={coin.mint} onClose={() => setReportOpen(false)} />}
    </div>
  );
}

function RoyaltyTransparency({ coin }: { coin: any }) {
  const status = String(coin.royaltyVerificationStatus || coin.royalty_status || "not_submitted");
  const label: Record<string, string> = {
    not_submitted: "Royalties Not Submitted",
    in_progress: "Royalty Verification In Progress",
    verified: "Royalty Verified",
    needs_update: "Royalty Verification Needs Update",
    payment_received: "Royalty Payment Received",
    pool_contributed: "Royalty Added To Coin Pool",
    redistributed: "Royalty Redistributed Into Coin",
    missed_payment: "Royalty Payment Missed",
  };
  const tone =
    status === "verified" || status === "pool_contributed" || status === "redistributed"
      ? "text-neon border-neon/20 bg-neon/10"
      : status === "needs_update" || status === "missed_payment"
        ? "text-red border-red/20 bg-red/10"
        : status === "in_progress" || status === "payment_received"
          ? "text-amber border-amber/20 bg-amber/10"
          : "text-mute border-edge bg-white/[0.04]";

  return (
    <section className="panel p-6 shadow-xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-mute mb-2">Royalty Transparency</div>
          <h2 className="text-2xl font-black text-ink">SONG·DAQ Royalty Pool</h2>
          <p className="mt-2 max-w-3xl text-sm text-mute leading-relaxed">
            When a verified artist assigns royalties to SONG·DAQ through their distributor, SONG·DAQ receives the monthly royalty split and can add that value into the song coin ecosystem through Royalty Pool contributions, liquidity support, buybacks, holder rewards, and/or protocol reserves.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${tone}`}>{label[status] || status}</span>
          <Link href="/splits" className="btn h-9 px-3 text-[10px] uppercase tracking-widest font-black">
            Set Up Royalty Split
          </Link>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KV k="Royalty Split" v={coin.royaltyPercentageCommitted ? `${coin.royaltyPercentageCommitted}%` : "Not verified"} />
        <KV k="Total Royalties Received" v={fmtUsd(Number(coin.totalRoyaltiesReceivedUsd || 0), 2)} />
        <KV k="Royalty Pool Added" v={fmtUsd(Number(coin.totalRoyaltyPoolContributionsUsd || 0), 2)} tooltip="The Royalty Pool shows royalty money received by SONG·DAQ and added into this coin’s ecosystem." />
        <KV k="Liquidity Support" v={fmtUsd(Number(coin.totalLiquidityAddedUsd || 0), 2)} tooltip="Liquidity shows how easily people can buy or sell without moving the price too much." />
        <KV k="Total Buybacks" v={fmtUsd(Number(coin.totalBuybacksUsd || 0), 2)} />
        <KV k="Holder Rewards" v={fmtUsd(Number(coin.totalHolderRewardsUsd || 0), 2)} />
        <KV k="Last Payment" v={coin.lastRoyaltyPaymentDate ? new Date(coin.lastRoyaltyPaymentDate).toLocaleDateString() : "None yet"} />
        <KV k="Next Expected" v={coin.nextExpectedRoyaltyPaymentDate ? new Date(coin.nextExpectedRoyaltyPaymentDate).toLocaleDateString() : "Not scheduled"} />
      </div>
      <div className="rounded-2xl border border-edge bg-panel2 p-4 text-sm text-mute leading-relaxed">
        Royalty activity may support a song coin’s ecosystem, but it does not guarantee price increases, profits, or liquidity.
      </div>
    </section>
  );
}

function KV({ k, v, tooltip, accent }: { k: string; v: string; tooltip?: string; accent?: "gain" | "lose" }) {
  const fallbackTooltips: Record<string, string> = {
    "Mkt Cap": "Market cap is the current coin price multiplied by the circulating supply.",
    "Market Cap": "Market cap is the current coin price multiplied by the circulating supply.",
    Liquidity: "Liquidity shows how easily people can buy or sell without moving the price too much.",
    "Total Supply": "Total supply is the full amount of coins created for this asset.",
    Circulating: "Circulating supply is the amount of coins currently active in the market.",
    Reserve: "Reserve is the backing or liquidity connected to the trading curve or pool.",
    Performance: "Performance reflects how the song coin is moving compared to its launch baseline and activity signals.",
  };
  const help = tooltip ?? fallbackTooltips[k];
  return (
    <div className="flex flex-col gap-1 border-b border-edge pb-3 group">
      <span className="text-mute text-[10px] uppercase tracking-widest font-bold group-hover:text-white transition inline-flex items-center gap-1">
        {help ? <InfoTooltip label={k} def={help} /> : k}
      </span>
      <span className={`num text-base font-bold tracking-wider ${accent === "gain" ? "gain" : accent === "lose" ? "lose" : "text-white"}`}>{v}</span>
    </div>
  );
}

function KVrow({ k, v, accent }: { k: string; v: string; accent?: "gain" | "lose" }) {
  return (
    <div className="flex items-center justify-between group">
      <span className="text-[10px] uppercase tracking-widest font-bold text-mute group-hover:text-white transition">{k}</span>
      <span className={`num text-xs font-bold tracking-wider ${accent === "gain" ? "gain drop-shadow-[0_0_5px_rgba(0,229,114,0.3)]" : accent === "lose" ? "lose drop-shadow-[0_0_5px_rgba(255,51,102,0.3)]" : "text-white"}`}>{v}</span>
    </div>
  );
}
