"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SafeImage } from "@/components/SafeImage";
import { Sparkline } from "@/components/Sparkline";
import { useSession } from "@/lib/store";
import { CoinTradeModal } from "@/components/CoinTradeModal";
import { PriceChart, type PricePointDTO } from "@/components/PriceChart";
import { useCoinWatchlist, useRecentCoins } from "@/lib/coinWatchlist";
import { ChartSkeleton } from "@/components/Skeleton";
import { useCoins } from "@/lib/useCoins";
import { fmtNum, fmtPct } from "@/lib/pricing";
import type { AudiusCoin } from "@/lib/audiusCoins";
import { Glossary } from "@/components/Tooltip";

const RANGES = ["LIVE", "15S", "1MIN", "15MIN", "30MIN", "1H", "1D", "1W", "1MO", "ALL"] as const;
type Range = typeof RANGES[number];
const RANGE_MS: Record<Range, number> = {
  "LIVE": 15_000,
  "15S": 15_000,
  "1MIN": 60_000,
  "15MIN": 900_000,
  "30MIN": 1800_000,
  "1H": 3600_000,
  "1D": 86400_000,
  "1W": 7 * 86400_000,
  "1MO": 30 * 86400_000,
  "ALL": Date.now() - 1700000000000,
};

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
  const [coin, setCoin] = useState<AudiusCoin | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tradeSide, setTradeSide] = useState<"BUY" | "SELL" | null>(null);
  const [points, setPoints] = useState<PricePointDTO[]>([]);
  const [range, setRange] = useState<Range>("1D");
  const [advancedMode, setAdvancedMode] = useState(false);
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
      const cj = await coinR.json();
      if (!coinR.ok) throw new Error(cj.error || "failed");
      setCoin(cj.coin);
      if (histR.ok) {
        const hj = await histR.json();
        setPoints(hj.candles ?? []);
      }
    } catch (e: any) { setErr(e.message); }
  }, [mint, range]);

  useEffect(() => { load(); const i = setInterval(load, 6_000); return () => clearInterval(i); }, [load]);

  // Fetch a few of the artist's tracks for the "news" panel.
  useEffect(() => {
    if (!coin?.artist_handle) { setTracks([]); return; }
    let alive = true;
    fetch(`/api/audius/tracks?handle=${encodeURIComponent(coin.artist_handle)}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : { tracks: [] })
      .then((j) => { if (alive) setTracks(j.tracks ?? []); })
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
    const cutoff = now - (RANGE_MS[range] || 86400000);
    
    // 1. Filter existing points
    let res = points.filter((x) => new Date(x.ts as any).getTime() >= cutoff);

    // 2. Map and ensure we have at least a current price point
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

      // If no points in range, synthesize a starting point at the cutoff
      if (res.length === 0) {
        res = [
          { ts: new Date(cutoff), open: livePrice, high: livePrice, low: livePrice, close: livePrice, volume: 0 } as any,
          livePoint
        ];
      } else {
        res.push(livePoint);
      }
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
        <div className="panel p-4 space-y-3 hidden lg:block bg-black/40 border border-white/5">
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
          <div className="panel p-6 flex gap-6 bg-black/40 border border-white/5">
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
      <div className="fixed inset-0 z-[100] bg-bg text-ink flex flex-col font-sans overflow-hidden">
        {/* Top Navbar */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 shrink-0 bg-bg shadow-md z-10">
          <div className="flex items-center gap-4">
            {coin.logo_uri ? <SafeImage src={coin.logo_uri} alt={coin.ticker} width={36} height={36} fallback={coin.ticker} className="rounded-md shadow-sm" /> : <div className="w-9 h-9 rounded-md bg-white/10" />}
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-white">${coin.ticker}</h1>
            </div>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-mono font-bold text-white">{fmtUsd(livePrice, 6)}</span>
              <span className={`num text-sm font-bold tracking-wider ${change >= 0 ? "gain" : "lose"}`}>
                {change >= 0 ? "+" : ""}{change.toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-4 ml-6 text-xs text-white/40 font-mono">
              <div>MC: <span className="text-white">${fmtNum(coin.marketCap ?? 0)}</span></div>
              <div>Vol: <span className="text-white">${fmtNum((coin.marketCap ?? 0) * 0.14)}</span></div>
            </div>
          </div>
          
          <button 
            onClick={() => setAdvancedMode(false)} 
            className="px-4 py-2 bg-red/10 text-red border border-red/20 hover:bg-red/20 transition-all rounded-md text-[10px] uppercase tracking-widest font-bold shadow-sm flex items-center gap-2"
          >
            <span>Exit Terminal</span>
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {/* Main Terminal Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Sidebar (Watchlist) */}
          <div className="w-80 border-r border-white/10 flex flex-col bg-panel2 overflow-y-auto no-scrollbar shrink-0">
            <div className="p-3 border-b border-white/5 bg-black/40">
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/40">Market Watch</div>
            </div>
            <ul className="divide-y divide-white/5">
              {sidebarItems.map((c) => {
                const ch = c.priceChange24hPercent ?? 0;
                return (
                  <li key={c.mint}>
                    <Link href={`/coin/${c.mint}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-all group">
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
          <div className="flex-1 flex flex-col min-w-0 bg-bg relative">
            <div className="absolute inset-0 bg-gradient-to-b from-neon/5 to-transparent pointer-events-none opacity-20" />
            
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-black/20 relative z-10 overflow-x-auto no-scrollbar">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded text-[10px] uppercase tracking-widest font-bold transition-all shrink-0 ${range === r ? "bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                >{r}</button>
              ))}
            </div>

            <div className="flex-1 p-4 relative z-10 min-h-[300px]">
              <PriceChart points={filtered} />
            </div>
          </div>

          {/* Right Sidebar (Trade Panel) */}
          <div className="w-[380px] border-l border-white/10 bg-panel2 flex flex-col justify-center items-center shrink-0 p-6 space-y-6">
            <div className="text-center space-y-2 mb-4">
              <div className="text-3xl font-mono font-bold text-white tracking-tighter">${coin.ticker}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Trading Desk</div>
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
      <aside className="panel p-0 flex flex-col h-fit lg:sticky lg:top-24 border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl">
        <div className="p-4 border-b border-white/10 bg-black/40">
          <input
            placeholder="Search Intelligence Database…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:border-neon/50 focus:ring-1 focus:ring-neon/50 transition-all font-mono"
          />
        </div>
        <div className="px-4 py-3 flex items-center justify-between bg-black/20">
          <div className="text-[10px] uppercase tracking-widest font-bold text-white/50">{search ? "Search Results" : watchlistCoins.length ? "Active Tracking" : "Market Movers"}</div>
          <span className="text-[10px] font-mono font-bold text-white/30">{sidebarItems.length}</span>
        </div>
        <ul className="divide-y divide-white/5 max-h-[65vh] overflow-y-auto">
          {sidebarItems.map((c) => {
            const ch = c.priceChange24hPercent ?? 0;
            const active = c.mint === mint;
            return (
              <li key={c.mint}>
                <Link
                  href={`/coin/${c.mint}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all group ${active ? "bg-neon/5 border-l-2 border-neon" : "border-l-2 border-transparent"}`}
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0 shadow-lg">
                    <SafeImage src={c.logo_uri} fill sizes="40px" alt={c.ticker} fallback={c.ticker} className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white tracking-wide truncate group-hover:text-neon transition">${c.ticker}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40 truncate mt-0.5">{c.artist_name ?? c.name}</div>
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
            <li className="px-4 py-10 text-center text-white/30 text-[10px] uppercase tracking-widest font-bold">No Records Found</li>
          )}
        </ul>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        {/* Tab bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabCoins.map((c) => {
            const active = c.mint === mint;
            return (
              <Link
                key={c.mint}
                href={`/coin/${c.mint}`}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${
                  active ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "text-white/40 border border-white/10 hover:text-white hover:bg-white/10"
                }`}
              >${c.ticker}</Link>
            );
          })}
          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block" />
          <button
            onClick={() => toggleWatch(coin.mint)}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-all shadow-md ${watching ? "bg-neon/20 text-neon border border-neon/30" : "bg-black/40 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white"}`}
          >{watching ? "★ Active Tracking" : "☆ Track Asset"}</button>
          <button className="px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all shadow-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setAdvancedMode(true)}>
            ◱ Terminal
          </button>
        </div>

        {/* Header */}
        <header className="panel p-6 flex flex-col md:flex-row items-start md:items-center gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-neon/5 to-transparent pointer-events-none mix-blend-screen" />
          
          <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-white/10 bg-black shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <SafeImage src={coin.logo_uri} fill sizes="112px" alt={coin.ticker} fallback={coin.ticker} className="object-cover" />
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-baseline gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md truncate">${coin.ticker}</h1>
              <span className="text-white/50 text-sm tracking-wide truncate">{coin.name}</span>
              {isOwner && <span className="text-[9px] uppercase tracking-widest font-bold text-violet bg-violet/10 px-2 py-0.5 rounded border border-violet/30 shadow-[0_0_5px_rgba(155,81,224,0.3)]">Your Asset</span>}
              {(coin as any).has_discord && <span className="text-[9px] uppercase tracking-widest font-bold text-[#5865F2] bg-[#5865F2]/10 px-2 py-0.5 rounded border border-[#5865F2]/30">Discord Active</span>}
            </div>
            <div className="text-white/40 text-xs font-medium uppercase tracking-widest flex items-center gap-2">
              {coin.artist_name && (
                <>
                  <span className="text-white/60">ISSUER:</span>
                  {coin.artist_handle
                    ? <a href={`https://audius.co/${coin.artist_handle}`} target="_blank" rel="noreferrer" className="text-white hover:text-neon transition">{coin.artist_name}</a>
                    : <span className="text-white">{coin.artist_name}</span>}
                  {coin.artist_handle ? <span className="font-mono text-white/50">(@{coin.artist_handle})</span> : ""}
                </>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-4">
              <span className="text-4xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{fmtUsd(coin.price ?? 0, 6)}</span>
              <span className={`num text-lg font-bold tracking-wider ${change >= 0 ? "gain drop-shadow-[0_0_10px_rgba(0,229,114,0.4)]" : "lose drop-shadow-[0_0_10px_rgba(255,51,102,0.4)]"}`}>
                {change >= 0 ? "+" : ""}{fmtPct(change)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold ml-2">24H</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0 relative z-10 w-full md:w-40">
            <button className="btn-primary py-3 font-bold tracking-widest text-xs shadow-[0_0_20px_rgba(0,229,114,0.4)]" onClick={() => setTradeSide("BUY")}>EXECUTE BUY</button>
            <button className="bg-red/10 border border-red/30 text-red py-3 rounded-lg font-bold tracking-widest text-xs hover:bg-red/20 transition disabled:opacity-50" disabled={isOwner} onClick={() => setTradeSide("SELL")}>EXECUTE SELL</button>
          </div>
        </header>

        {/* Chart */}
        <section className="panel p-5 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 pointer-events-none" />
          <div className="px-2 pt-1 pb-4 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-4 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold transition-all ${
                    range === r ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
                  }`}
                >{r}</button>
              ))}
            </div>
          </div>
          <div className="relative z-10 h-[380px]">
            <PriceChart points={points} quote="USD" height={380} />
          </div>
        </section>

        {/* Apple-Stocks-style stats */}
        <section className="panel p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 text-sm">
            <KV k="Open" v={fmtUsd((coin as any).history24hPrice ?? coin.price ?? 0, 6)} />
            <KV k="High 24h" v={fmtUsd(high24 ?? 0, 6)} />
            <KV k="Low 24h" v={fmtUsd(low24 ?? 0, 6)} />
            <KV k="Last" v={fmtUsd(coin.price ?? 0, 6)} />
            <KV k="Vol 24h" v={fmtUsd(coin.v24hUSD ?? 0, 0)} tooltip="24-hour trading volume in USD." />
            <KV k="Trades 24h" v={fmtNum(coin.trade24h ?? 0)} />
            <KV k="Buys / Sells" v={`${coin.buy24h ?? 0} / ${coin.sell24h ?? 0}`} accent={(coin.buy24h ?? 0) > (coin.sell24h ?? 0) ? "gain" : "lose"} />
            <KV k="Wallets 24h" v={fmtNum(coin.uniqueWallet24h ?? 0)} />
            <KV k="Mkt Cap" v={fmtUsd(coin.marketCap ?? 0, 0)} tooltip="Current market valuation based on spot price." />
            <KV k="FDV" v={fmtUsd((coin as any).fdv ?? coin.marketCap ?? 0, 0)} tooltip="Fully Diluted Valuation." />
            <KV k="Liquidity" v={fmtUsd(coin.liquidity ?? 0, 0)} />
            <KV k="Holders" v={fmtNum(coin.holder ?? 0)} />
            <KV k="Total Supply" v={fmtNum(coin.totalSupply ?? 0)} />
            <KV k="Circulating" v={fmtNum(coin.circulatingSupply ?? 0)} />
            <KV k="Markets" v={String((coin as any).numberMarkets ?? 1)} />
            <KV k="Curve" v={dyn?.isMigrated ? "Migrated" : (dyn?.curveProgress != null ? `${(dyn.curveProgress * 100).toFixed(0)}%` : "—")} />
          </div>
        </section>

        {/* About */}
        {coin.description && (
          <section className="panel p-6 shadow-xl">
            <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3">Asset Intelligence Report</div>
            <p className="text-sm leading-relaxed text-white/80 font-medium">{coin.description}</p>
          </section>
        )}

        {/* News-style "tracks by artist" cards */}
        {!!tracks.length && (
          <section>
            <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 px-1">Issuer Discography</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tracks.slice(0, 4).map((t: any) => (
                <a
                  key={t.id}
                  href={`https://audius.co/${coin.artist_handle}/${t.permalink ?? ""}`.replace(/\/+$/, "")}
                  target="_blank"
                  rel="noreferrer"
                  className="panel p-4 flex gap-4 hover:bg-white/5 transition-all group shadow-lg border border-white/5"
                >
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0 shadow-md">
                    <SafeImage
                      src={t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? null}
                      fill sizes="64px" alt={t.title} fallback={t.title} className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white truncate group-hover:text-neon transition">{t.title}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50 truncate mt-0.5">{coin.artist_name}</div>
                    <div className="text-[10px] font-mono font-bold text-white/40 mt-2 flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="text-neon">▶</span> {fmtNum(t.playCount ?? t.play_count ?? 0)}</span>
                      <span className="flex items-center gap-1"><span className="text-red">♥</span> {fmtNum(t.favoriteCount ?? t.favorite_count ?? 0)}</span>
                      <span className="flex items-center gap-1"><span className="text-violet">↻</span> {fmtNum(t.repostCount ?? t.repost_count ?? 0)}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* On-chain breakdown */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="panel p-5 space-y-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 border-b border-white/10 pb-2">24h Network Activity</div>
            <KVrow k="Buy Volume" v={`${fmtNum(coin.buy24h ?? 0)} · ${fmtUsd((coin as any).vBuy24hUSD ?? 0, 0)}`} accent="gain" />
            <KVrow k="Sell Volume" v={`${fmtNum(coin.sell24h ?? 0)} · ${fmtUsd((coin as any).vSell24hUSD ?? 0, 0)}`} accent="lose" />
            <KVrow k="Unique Wallets" v={fmtNum(coin.uniqueWallet24h ?? 0)} />
            <KVrow k="Trade Velocity Δ" v={`${((coin as any).trade24hChangePercent ?? 0).toFixed(1)}%`} />
          </div>
          <div className="panel p-5 space-y-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 border-b border-white/10 pb-2">
              <Glossary term="Locker" def="Tokens allocated to the artist, securely vested to prevent market dumping.">Artist Vesting Protocol</Glossary>
            </div>
            <KVrow k="Locked Supply" v={fmtNum((locker.locked ?? 0) / 1e9)} />
            <KVrow k="Vested Supply" v={fmtNum((locker.unlocked ?? 0) / 1e9)} />
            <KVrow k="Liquid Claimable" v={fmtNum((locker.claimable ?? 0) / 1e9)} accent="gain" />
            {locker.address && <KVrow k="Contract" v={shortMint(locker.address)} />}
          </div>
          <div className="panel p-5 space-y-4 shadow-xl">
            <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 border-b border-white/10 pb-2">
              <Glossary term="Reward Pool" def="Trading fees automatically collected and held for artist payout.">Fee Collection Vault</Glossary>
            </div>
            <KVrow k="Vault TVL" v={fmtNum((reward.balance ?? 0) / 1e9)} />
            <KVrow k="Lifetime Fees" v={fmtNum(((coin as any).artist_fees?.total_fees ?? 0) / 1e9)} />
            <KVrow k="Pending Claim" v={fmtNum(((coin as any).artist_fees?.unclaimed_fees ?? 0) / 1e9)} accent="gain" />
            {reward.address && <KVrow k="Contract" v={shortMint(reward.address)} />}
          </div>
        </section>

        {/* Mint + links */}
        <section className="panel p-5 shadow-xl space-y-4 bg-gradient-to-r from-black/40 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Solana Network Mint</span>
            <button
              className="text-[9px] uppercase tracking-widest font-bold px-3 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10 transition cursor-pointer text-white"
              onClick={() => navigator.clipboard.writeText(coin.mint)}
              title="Copy mint address"
            >Copy Identity</button>
          </div>
          <div className="font-mono text-xs text-white/80 break-all bg-black/60 p-3 rounded-lg border border-white/10">{coin.mint}</div>
          <div className="flex flex-wrap gap-3 pt-2">
            <a className="text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-white transition flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10" href={`https://solscan.io/token/${coin.mint}`} target="_blank" rel="noreferrer">Solscan ↗</a>
            <a className="text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-white transition flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10" href={`https://birdeye.so/token/${coin.mint}?chain=solana`} target="_blank" rel="noreferrer">Birdeye ↗</a>
            <a className="text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-white transition flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10" href={`https://audius.co/clubs/${coin.ticker?.toLowerCase()}`} target="_blank" rel="noreferrer">Audius Clubs ↗</a>
            {coin.link_1 && <a className="text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-white transition flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10" href={coin.link_1} target="_blank" rel="noreferrer">External 1</a>}
            {coin.link_2 && <a className="text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-white transition flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10" href={coin.link_2} target="_blank" rel="noreferrer">External 2</a>}
          </div>
        </section>
      </div>

      {tradeSide && (
        <CoinTradeModal coin={coin} side={tradeSide} onClose={() => setTradeSide(null)} onDone={load} />
      )}
    </div>
  );
}

function KV({ k, v, tooltip, accent }: { k: string; v: string; tooltip?: string; accent?: "gain" | "lose" }) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/10 pb-3 group">
      <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold group-hover:text-white/60 transition">
        {tooltip ? <Glossary term={k} def={tooltip}>{k}</Glossary> : k}
      </span>
      <span className={`num text-base font-bold tracking-wider ${accent === "gain" ? "gain" : accent === "lose" ? "lose" : "text-white"}`}>{v}</span>
    </div>
  );
}

function KVrow({ k, v, accent }: { k: string; v: string; accent?: "gain" | "lose" }) {
  return (
    <div className="flex items-center justify-between group">
      <span className="text-[10px] uppercase tracking-widest font-bold text-white/50 group-hover:text-white/80 transition">{k}</span>
      <span className={`num text-xs font-bold tracking-wider ${accent === "gain" ? "gain drop-shadow-[0_0_5px_rgba(0,229,114,0.3)]" : accent === "lose" ? "lose drop-shadow-[0_0_5px_rgba(255,51,102,0.3)]" : "text-white"}`}>{v}</span>
    </div>
  );
}
