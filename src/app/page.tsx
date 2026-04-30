"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SongCard, SongListRow, type SongRow } from "@/components/SongCard";
import { CoinCard, CoinListRow } from "@/components/CoinCard";
import { CoinTradeModal } from "@/components/CoinTradeModal";
import { HeatMap } from "@/components/HeatMap";
import { TradeFeed } from "@/components/TradeFeed";
import { NewsFeed } from "@/components/NewsFeed";
import { CardGridSkeleton, StatRowSkeleton, FeedSkeleton } from "@/components/Skeleton";
import { ArtistDashboard } from "@/components/ArtistDashboard";
import { LandingPage } from "@/components/LandingPage";
import { useSession, useWatchlist } from "@/lib/store";
import { fmtSol, fmtNum, fmtPct } from "@/lib/pricing";
import { useCoins } from "@/lib/useCoins";
import type { AudiusCoin } from "@/lib/audiusCoins";

import { Glossary, OnboardingHint } from "@/components/Tooltip";
import { InfoBanner } from "@/components/InfoBanner";
import { Star, LayoutGrid, List, Flame, TrendingUp, BarChart3 } from "lucide-react";

type Market = "coins" | "songs";
type CoinSort = "marketCap" | "volume" | "gainers" | "holders";
type SongSort = "trending" | "gainers" | "volume" | "new";
type ViewMode = "grid" | "list" | "heat";

const COIN_SORTS: { id: CoinSort; label: string }[] = [
  { id: "marketCap", label: "MKT CAP" },
  { id: "volume", label: "VOLUME" },
  { id: "gainers", label: "GAINERS" },
  { id: "holders", label: "HOLDERS" },
];
const SONG_SORTS: { id: SongSort; label: string }[] = [
  { id: "trending", label: "TRENDING" },
  { id: "gainers", label: "GAINERS" },
  { id: "volume", label: "VOLUME" },
  { id: "new", label: "NEW LAUNCHES" },
];

/* ─── Premium Segmented Control ────────────────────────── */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-white/[0.02] backdrop-blur-xl border border-white/[0.04] rounded-xl p-0.5 relative overflow-hidden">
      <div className="flex overflow-x-auto no-scrollbar scroll-smooth">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={`relative z-10 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 shrink-0 whitespace-nowrap ${
                active ? "text-white" : "text-white/20 hover:text-white/50"
              }`}
            >
              {active && (
                <motion.div
                  layoutId={`seg-pill-${options[0].id}`}
                  className="absolute inset-0 bg-white/[0.06] border border-white/[0.06] rounded-lg"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="truncate max-w-[100px] block">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Premium Stat Card with pulse ─────────────────────── */
function Stat({ k, v, accent, sub, tooltip }: { k: string; v: string; accent?: "gain" | "lose"; sub?: string; tooltip?: string }) {
  const content = (
    <div className="label">
      {tooltip ? <Glossary term={k} def={tooltip} category="financial">{k}</Glossary> : k}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      className="panel-elevated p-5 group relative overflow-hidden grain"
    >
      {/* Ambient corner glow */}
      <div className="absolute -right-10 -top-10 w-20 h-20 bg-white/[0.02] rounded-full blur-[30px] pointer-events-none group-hover:bg-white/[0.04] transition duration-700" />
      {content}
      <div className={`mt-2 text-2xl font-mono font-black tracking-tight ${
        accent === "gain" ? "text-neon" : accent === "lose" ? "text-red" : "text-white"
      }`}>
        {v}
      </div>
      {sub && <div className="text-[10px] text-white/15 uppercase tracking-widest mt-1.5 font-bold">{sub}</div>}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Discovery Engine — TikTok + Robinhood
   ═══════════════════════════════════════════════════════════ */
export default function DiscoveryEngine() {
  const { audius, address } = useSession();
  const watchlist = useWatchlist();
  const [market, setMarket] = useState<Market>("coins");
  const [coinSort, setCoinSort] = useState<CoinSort>("marketCap");
  const [songSort, setSongSort] = useState<SongSort>("trending");
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [songLoading, setSongLoading] = useState(true);
  const [trade, setTrade] = useState<{ side: "BUY" | "SELL"; coin: AudiusCoin } | null>(null);
  const [me, setMe] = useState<any>(null);
  const [view, setView] = useState<ViewMode>("grid");
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  const { coins, loading: coinLoading } = useCoins(coinSort);
  const loading = market === "coins" ? coinLoading : songLoading;

  // Fetch user role
  useEffect(() => {
    if (!address) { setMe(null); return; }
    fetch(`/api/me?wallet=${address}`).then((r) => r.json()).then((j) => setMe(j.user)).catch(() => {});
  }, [address, audius]);

  // Fetch songs when switching to songs tab
  useEffect(() => {
    if (market !== "songs") return;
    let alive = true;
    setSongLoading(true);
    const load = async () => {
      try {
        const j = await fetch(`/api/songs?sort=${songSort}`, { cache: "no-store" }).then((r) => r.json());
        if (alive) setSongs(j.songs || []);
      } finally { if (alive) setSongLoading(false); }
    };
    load();
    const i = setInterval(load, 12_000);
    return () => { alive = false; clearInterval(i); };
  }, [market, songSort]);

  const role = me?.role ?? "INVESTOR";
  const isArtist = role === "ARTIST";
  const mode = (me?.preferredMode ?? "INVESTOR") as "ARTIST" | "INVESTOR";

  // ─── Aggregate stats ──
  const coinTotals = useMemo(() => coins.reduce(
    (a, c) => ({ cap: a.cap + (c.marketCap ?? 0), vol: a.vol + (c.v24hUSD ?? 0), holders: a.holders + (c.holder ?? 0) }),
    { cap: 0, vol: 0, holders: 0 },
  ), [coins]);

  const songTotals = useMemo(() => {
    let cap = 0, vol = 0, perf = 0;
    songs.forEach((s) => { cap += s.marketCap; vol += s.volume24h; perf += s.performance; });
    return { cap, vol, avg: songs.length ? perf / songs.length : 1 };
  }, [songs]);

  // Filter by watchlist
  const filteredCoins = useMemo(() => {
    if (!showWatchlistOnly) return coins;
    return coins.filter(c => watchlist.items.includes(c.mint));
  }, [coins, showWatchlistOnly, watchlist.items]);

  const filteredSongs = useMemo(() => {
    if (!showWatchlistOnly) return songs;
    return songs.filter(s => watchlist.items.includes(s.id));
  }, [songs, showWatchlistOnly, watchlist.items]);

  // Not logged in → landing page
  if (!address) return <LandingPage />;

  return (
    <div className="space-y-5">
      {/* ─── Hero Section ──────────────────────────────────── */}
      <section className="relative rounded-3xl overflow-hidden panel-elevated p-10 md:p-14 flex flex-col md:flex-row gap-8 items-center justify-between grain">
        {/* Ambient lighting */}
        <div className="orb orb-neon w-[500px] h-[500px] -top-40 -right-40 opacity-40" />
        <div className="orb orb-violet w-[400px] h-[400px] -bottom-40 -left-40 opacity-30" style={{ animationDelay: "-10s" }} />
        
        <div className="flex-1 min-w-0 relative z-10 space-y-5 text-center md:text-left">
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.3em] font-black text-white/15 mb-3">Live Music Economy</div>
            <h1 className="text-4xl md:text-6xl font-black tracking-[-0.04em] text-white leading-[0.9]">
              {isArtist ? (
                <>Launch <span className="text-gradient-violet">&</span> Grow</>
              ) : (
                <>Discover <span className="text-gradient-neon">The</span> Future</>
              )}
            </h1>
          </div>
          <p className="text-white/30 text-lg max-w-xl font-medium leading-relaxed">
            {isArtist
              ? `Establish your market presence, @${audius?.handle}. Convert streaming engagement into institutional capital.`
              : "Discover breakout artists early. Support their Song Coins, build your reputation, and gain status as they grow."}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 shrink-0 relative z-10 w-full md:w-auto">
            {isArtist && (
              <Link href="/artist" className="w-full sm:w-auto btn-primary px-8 py-3.5 text-[10px] font-black tracking-widest shadow-neon-glow">
                LAUNCH TOKEN
              </Link>
            )}
            <Link href="/portfolio" className="w-full sm:w-auto btn-glass px-8 py-3.5 text-[10px] uppercase tracking-widest font-black text-center">
              YOUR REPUTATION & PORTFOLIO
            </Link>
          </div>
        </div>

        <div className="hidden lg:block relative z-10 shrink-0">
          <div className="w-52 h-52 rounded-[40px] bg-white/[0.02] border border-white/[0.04] backdrop-blur-3xl p-7 flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-neon/5 to-transparent rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="text-center space-y-3">
              <div className="text-5xl font-black text-white group-hover:scale-110 transition-transform duration-500">100%</div>
              <div className="text-[9px] uppercase tracking-widest font-black text-white/20">Verified On-Chain</div>
            </div>
          </div>
        </div>
      </section>

      <InfoBanner />

      {/* ─── Market Controls ───────────────────────────── */}
      <section className="flex items-center gap-3 flex-wrap pb-2 border-b border-white/[0.03]">
        <Segmented
          options={[
            { id: "coins" as Market, label: "Artist Coins" },
            { id: "songs" as Market, label: "Song Tokens" },
          ]}
          value={market}
          onChange={setMarket}
        />

        <span className="h-5 w-px bg-white/[0.04]" />

        <Segmented
          options={market === "coins" ? COIN_SORTS : SONG_SORTS}
          value={market === "coins" ? coinSort : songSort}
          onChange={(v) => market === "coins" ? setCoinSort(v as CoinSort) : setSongSort(v as SongSort)}
        />

        <span className="h-5 w-px bg-white/[0.04]" />

        {/* View mode icons */}
        <div className="flex bg-white/[0.02] border border-white/[0.04] rounded-xl p-0.5">
          {([
            { id: "grid" as const, icon: <LayoutGrid size={12} /> },
            { id: "list" as const, icon: <List size={12} /> },
            { id: "heat" as const, icon: <Flame size={12} /> },
          ]).map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`w-8 h-7 flex items-center justify-center rounded-lg transition-all ${
                view === v.id ? "bg-white/[0.06] text-white" : "text-white/15 hover:text-white/40"
              }`}
            >
              {v.icon}
            </button>
          ))}
        </div>

        {/* Watchlist filter */}
        <button
          onClick={() => setShowWatchlistOnly(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
            showWatchlistOnly
              ? "bg-gold/10 border-gold/20 text-gold"
              : "bg-white/[0.02] border-white/[0.04] text-white/15 hover:text-white/30"
          }`}
        >
          <Star size={10} fill={showWatchlistOnly ? "currentColor" : "none"} />
          Watchlist
          {watchlist.items.length > 0 && (
            <span className="text-[9px] bg-white/[0.04] px-1.5 py-0.5 rounded-full">{watchlist.items.length}</span>
          )}
        </button>

        <div className="ml-auto">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(0,229,114,0.5)] animate-pulseDot" />
            <span className="text-[10px] text-white/30 uppercase tracking-widest font-black">
              {loading ? "SYNCING..." : market === "coins" ? `${filteredCoins.length} ASSETS` : `${filteredSongs.length} ASSETS`}
            </span>
          </div>
        </div>
      </section>

      {/* ─── Stats Row ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading && !coins.length && !songs.length ? (
          <StatRowSkeleton key="stat-skel" />
        ) : market === "coins" ? (
          <motion.section
            key="coin-stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <Stat k="Listed" v={fmtNum(coins.length)} tooltip="Total number of artist coins currently trading on the exchange." />
            <Stat k="Combined Cap" v={`$${fmtNum(coinTotals.cap)}`} tooltip="The total market capitalization of all artist coins on the network." />
            <Stat k="24h Volume" v={`$${fmtNum(coinTotals.vol)}`} tooltip="Total dollar volume traded across all artist coins in the last 24 hours." />
            <Stat k="Holders" v={fmtNum(coinTotals.holders)} tooltip="Total number of unique wallets holding artist coins across the platform." />
          </motion.section>
        ) : (
          <motion.section
            key="song-stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <Stat k="Listings" v={fmtNum(songs.length)} tooltip="Total number of songs successfully tokenized and currently trading." />
            <Stat k="Market Cap" v={`${fmtSol(songTotals.cap, 2)} SOL`} tooltip="The aggregate value of all tokenized song markets combined." />
            <Stat k="24h Volume" v={`${fmtSol(songTotals.vol, 2)} SOL`} tooltip="Total trading volume across all song tokens in the last 24 hours." />
            <Stat k="Avg Perf" v={fmtPct((songTotals.avg - 1) * 100)} accent={(songTotals.avg - 1) >= 0 ? "gain" : "lose"} tooltip="Average performance of all song coins relative to their initial launch price." />
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── Activity feeds ─────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-3">
        <NewsFeed />
        <TradeFeed />
      </section>

      {/* ─── Main Grid ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading && !coins.length && !songs.length ? (
          <CardGridSkeleton key="cards-skel" count={6} />
        ) : market === "coins" ? (
          view === "heat" ? (
            <motion.div key="heat" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <HeatMap coins={filteredCoins} onSelect={(c) => setTrade({ side: "BUY", coin: c })} />
            </motion.div>
          ) : view === "list" ? (
            <motion.section
              key="coins-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-1"
            >
              <div className="px-6 py-2 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/15 border-b border-white/[0.03]">
                <span className="w-6" />
                <span className="w-9">Logo</span>
                <span className="flex-1">Asset Info</span>
                <span className="w-28 text-right">Valuation</span>
                <span className="w-28 text-right">Price / 24h</span>
                <span className="w-20 text-center">Action</span>
              </div>
              {filteredCoins.map((c) => (
                <CoinListRow
                  key={c.mint}
                  c={c}
                  isOwner={!!(audius?.userId && audius.userId === c.owner_id)}
                  onTrade={(side, coin) => setTrade({ side, coin })}
                />
              ))}
            </motion.section>
          ) : (
            <motion.section
              key="coins-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
            >
              {filteredCoins.map((c, i) => (
                <motion.div
                  key={c.mint}
                  initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
                >
                  <CoinCard
                    c={c}
                    isOwner={!!(audius?.userId && audius.userId === c.owner_id)}
                    onTrade={(side, coin) => setTrade({ side, coin })}
                  />
                </motion.div>
              ))}
              {!filteredCoins.length && (
                <div className="md:col-span-2 xl:col-span-3 panel-elevated p-12 text-center grain">
                  {showWatchlistOnly ? (
                    <>
                      <Star size={32} className="text-white/10 mx-auto mb-3" />
                      <div className="text-white/30 text-sm font-bold">Your watchlist is empty</div>
                      <div className="text-white/15 text-xs mt-1">Star assets to add them to your watchlist</div>
                      <button onClick={() => setShowWatchlistOnly(false)} className="btn mt-4 text-xs">Show All Assets</button>
                    </>
                  ) : (
                    <>
                      <div className="text-white/30 text-sm font-bold">No Audius coins reachable right now</div>
                      <button onClick={() => setMarket("songs")} className="btn mt-3 text-xs">Browse Artist Coins instead →</button>
                    </>
                  )}
                </div>
              )}
            </motion.section>
          )
        ) : view === "list" ? (
          <motion.section
            key="songs-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-1"
          >
            <div className="px-6 py-2 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/15 border-b border-white/[0.03]">
              <span className="w-6" />
              <span className="w-9">Cover</span>
              <span className="flex-1">Asset / Artist</span>
              <span className="w-28 text-right">Valuation</span>
              <span className="w-28 text-right">Price / 24h</span>
              <span className="w-24 text-center">Status</span>
            </div>
            {filteredSongs.map((s) => (
              <SongListRow key={s.id} s={s} />
            ))}
          </motion.section>
        ) : (
          <motion.section
            key="songs-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
          >
            {filteredSongs.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: Math.min(i * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
              >
                <SongCard s={s} />
              </motion.div>
            ))}
            {!filteredSongs.length && (
              <div className="md:col-span-2 xl:col-span-3 panel-elevated p-12 text-center grain">
                {showWatchlistOnly ? (
                  <>
                    <Star size={32} className="text-white/10 mx-auto mb-3" />
                    <div className="text-white/30 text-sm font-bold">No songs in watchlist</div>
                    <button onClick={() => setShowWatchlistOnly(false)} className="btn mt-4 text-xs">Show All</button>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold mb-1 text-white/50">No Artist Coins yet</div>
                    <div className="text-white/20 text-sm mb-3">Be the first to tokenize your music.</div>
                    {isArtist && <Link href="/artist" className="btn-primary text-xs">+ Launch Artist Coin</Link>}
                  </>
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── Trade modal ───────────────────────────────── */}
      {trade && (
        <CoinTradeModal coin={trade.coin} side={trade.side} onClose={() => setTrade(null)} />
      )}

      {/* ─── Progressive onboarding ────────────────────── */}
      <OnboardingHint
        id="watchlist-intro"
        title="Pro tip: Build your watchlist"
        description="Star any asset to add it to your watchlist. Filter the market view to see only your tracked assets."
        icon={<Star size={16} />}
      />
    </div>
  );
}
