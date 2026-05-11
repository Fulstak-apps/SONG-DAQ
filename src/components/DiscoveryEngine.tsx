"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SongCard, SongListRow, type SongRow } from "@/components/SongCard";
import { CoinCard, CoinListRow } from "@/components/CoinCard";
import { CoinTradeModal } from "@/components/CoinTradeModal";
import { CoinPreviewModal } from "@/components/CoinPreviewModal";
import { HeatMap } from "@/components/HeatMap";
import { TradeFeed } from "@/components/TradeFeed";
import { NewsFeed } from "@/components/NewsFeed";
import { CardGridSkeleton, StatRowSkeleton, FeedSkeleton } from "@/components/Skeleton";
import { ArtistDashboard } from "@/components/ArtistDashboard";
import { AudiencePlaylist } from "@/components/AudiencePlaylist";
import { useSession, useUI, useWatchlist } from "@/lib/store";
import { fmtSol, fmtNum, fmtPct } from "@/lib/pricing";
import { useCoins } from "@/lib/useCoins";
import type { AudiusCoin } from "@/lib/audiusCoins";

import { Glossary, OnboardingHint } from "@/components/Tooltip";
import { InfoBanner } from "@/components/InfoBanner";
import { Star, LayoutGrid, List, Flame, TrendingUp, BarChart3, Music, ShieldCheck, Wallet } from "lucide-react";
import { calculateCoinRisk } from "@/lib/risk/calculateCoinRisk";

type Market = "coins" | "songs";
type CoinSort = "quality" | "marketCap" | "volume" | "gainers" | "holders";
type SongSort = "trending" | "gainers" | "volume" | "new";
type ViewMode = "grid" | "list" | "heat";
type MarketFilter = "all" | "verified" | "locked" | "lowRisk" | "rising" | "new" | "holders";

const COIN_SORTS: { id: CoinSort; label: string }[] = [
  { id: "quality", label: "QUALITY" },
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
    <div className="w-full sm:w-fit max-w-full flex bg-white/[0.055] backdrop-blur-xl border border-edge rounded-xl p-0.5 relative min-w-0">
      <div className="flex w-full sm:w-fit max-w-full flex-wrap gap-0.5 min-w-0">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
            className={`relative z-10 flex-1 sm:flex-none min-w-[92px] sm:min-w-[116px] px-3 sm:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 shrink-0 whitespace-nowrap ${
                active ? "text-ink" : "text-mute hover:text-ink"
              }`}
            >
              {active && (
                <motion.div
                  layoutId={`seg-pill-${options[0].id}`}
                  className="absolute inset-0 bg-white/[0.1] border border-edge rounded-lg"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="block whitespace-nowrap">{o.label}</span>
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
        accent === "gain" ? "text-neon" : accent === "lose" ? "text-red" : "text-ink"
      }`}>
        {v}
      </div>
      {sub && <div className="text-[10px] text-mute uppercase tracking-widest mt-1.5 font-bold">{sub}</div>}
    </motion.div>
  );
}

function fmtStatCompact(n: number) {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(n) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(n) >= 10_000 ? 1 : 0,
  }).format(n);
}

function fmtUsdCompact(n: number) {
  if (!Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function HeroPulseRow({ label, value, accent = "text-ink" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-white/[0.045] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 text-[10px] uppercase tracking-[0.2em] font-black text-mute truncate">{label}</span>
        <motion.span
          key={value}
          initial={{ opacity: 0.65, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`font-mono text-lg font-black tabular-nums ${accent}`}
        >
          {value}
        </motion.span>
      </div>
    </div>
  );
}

function MarketPrimer({ onConnect }: { onConnect: () => void }) {
  const cards = [
    {
      icon: <Wallet size={18} />,
      title: "Investors connect a Solana wallet",
      text: "Trading requires a Solana signature. Browse freely, then connect your investor wallet when you are ready to buy or sell.",
      tone: "text-neon border-neon/20 bg-neon/8",
    },
    {
      icon: <Music size={18} />,
      title: "Artists connect Audius first",
      text: "Artist mode starts with your Audius identity. If your Audius profile has a Solana wallet, SONG·DAQ can use it; external wallets are optional.",
      tone: "text-violet border-violet/20 bg-violet/8",
    },
    {
      icon: <ShieldCheck size={18} />,
      title: "Market data stays live",
      text: "Prices, holders, volume, news, and artist profiles are live while you browse. Once connected, this area becomes a pure trading dashboard.",
      tone: "text-cyan border-cyan/20 bg-cyan/8",
    },
  ];
  return (
    <section className="grid lg:grid-cols-[1fr_320px] gap-3">
      <div className="panel-elevated p-5 grain">
        <div className="text-[10px] uppercase tracking-[0.28em] font-black text-mute mb-4">Before You Connect</div>
        <div className="grid md:grid-cols-3 gap-3">
          {cards.map((card) => (
            <div key={card.title} className="rounded-xl border border-edge bg-white/[0.055] p-4">
              <div className={`w-10 h-10 rounded-xl border ${card.tone} grid place-items-center mb-3`}>{card.icon}</div>
              <div className="text-sm font-black text-ink tracking-tight">{card.title}</div>
              <p className="text-xs text-mute leading-relaxed mt-2">{card.text}</p>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onConnect} className="panel-elevated p-5 text-left group hover:border-neon/25 transition grain">
        <div className="text-[10px] uppercase tracking-[0.28em] font-black text-neon mb-3">Enter Market</div>
        <div className="text-2xl font-black text-white tracking-tight">Connect to Trade</div>
        <p className="text-sm text-mute mt-2 leading-relaxed">Choose investor wallet or artist Audius login in one flow.</p>
        <div className="mt-5 btn-primary w-full text-[10px] font-black tracking-widest">CONNECT</div>
      </button>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Discovery Engine — TikTok + Robinhood
   ═══════════════════════════════════════════════════════════ */
export default function DiscoveryEngine() {
  const { audius, address } = useSession();
  const { openLoginModal } = useUI();
  const watchlist = useWatchlist();
  const [market, setMarket] = useState<Market>("coins");
  const [coinSort, setCoinSort] = useState<CoinSort>("quality");
  const [songSort, setSongSort] = useState<SongSort>("trending");
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [songLoading, setSongLoading] = useState(true);
  const [trade, setTrade] = useState<{ side: "BUY" | "SELL"; coin: AudiusCoin } | null>(null);
  const [preview, setPreview] = useState<AudiusCoin | null>(null);
  const [me, setMe] = useState<any>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [artistQuery, setArtistQuery] = useState("");
  const [artistResults, setArtistResults] = useState<any[]>([]);
  const [artistSearching, setArtistSearching] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [networkStats, setNetworkStats] = useState({ tradingVolume: 0, activeArtists: 0, songsTokenized: 0 });
  const heroText = [
    { a: "Insurance and", b: "liquidity.", color: "text-gradient-neon" },
    { a: "100% verified", b: "on-chain.", color: "text-gradient-violet" },
    { a: "Earn stream", b: "royalties.", color: "text-gradient-cyan" },
    { a: "Real-time", b: "audit protocol.", color: "text-gradient-gold" },
  ];
  const hero = heroText[heroIdx];

  const { coins, loading: coinLoading } = useCoins(coinSort);
  const loading = market === "coins" ? coinLoading : songLoading;

  useEffect(() => {
    const i = setInterval(() => setHeroIdx((curr) => (curr + 1) % heroText.length), 4000);
    return () => clearInterval(i);
  }, [heroText.length]);

  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setNetworkStats({
          tradingVolume: Number(j.tradingVolume ?? 0),
          activeArtists: Number(j.activeArtists ?? 0),
          songsTokenized: Number(j.songsTokenized ?? 0),
        });
      })
      .catch(() => {});
    load();
    const i = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(i); };
  }, []);

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

  const heroPulse = useMemo(() => ({
    volume: networkStats.tradingVolume || coinTotals.vol + songTotals.vol,
    artists: networkStats.activeArtists || coins.length,
    songs: Math.max(networkStats.songsTokenized, songs.length, coins.length),
  }), [networkStats, coinTotals.vol, songTotals.vol, coins.length, songs.length]);

  // Filter by watchlist
  const filteredCoins = useMemo(() => {
    let list = showWatchlistOnly ? coins.filter(c => watchlist.items.includes(c.mint)) : coins;
    if (marketFilter !== "all") {
      list = list.filter((c) => {
        const risk = calculateCoinRisk(c as any);
        const liquidity = Number((c as any).liquidity ?? (c as any).reserveSol ?? (c as any).liquidityPairAmount ?? 0);
        const verified = Boolean((c as any).artist_handle || (c as any).audiusVerified || (c as any).audius_track_id);
        switch (marketFilter) {
          case "verified":
            return verified;
          case "locked":
            return Boolean((c as any).splitsLocked || (c as any).liquidityLocked);
          case "lowRisk":
            return risk.score >= 75;
          case "rising":
            return (c.priceChange24hPercent ?? 0) > 0 || (c.v24hUSD ?? 0) > (c.marketCap ?? 0) * 0.01;
          case "new":
            return liquidity > 0 && (c.marketCap ?? 0) < 25_000;
          case "holders":
            return Number((c as any).uniqueWallet24h ?? c.holder ?? 0) > 10;
          default:
            return true;
        }
      });
    }
    return [...list].sort((a, b) => {
      const ar = calculateCoinRisk(a as any).score;
      const br = calculateCoinRisk(b as any).score;
      const av = Number(a.v24hUSD ?? 0);
      const bv = Number(b.v24hUSD ?? 0);
      const al = Number((a as any).liquidity ?? 0);
      const bl = Number((b as any).liquidity ?? 0);
      return (br * 1000 + bv * 0.002 + bl * 0.2) - (ar * 1000 + av * 0.002 + al * 0.2);
    });
  }, [coins, showWatchlistOnly, watchlist.items, marketFilter]);

  const filteredSongs = useMemo(() => {
    if (!showWatchlistOnly) return songs;
    return songs.filter(s => watchlist.items.includes(s.id));
  }, [songs, showWatchlistOnly, watchlist.items]);

  useEffect(() => {
    const q = artistQuery.trim();
    if (q.length < 2) {
      setArtistResults([]);
      setArtistSearching(false);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      setArtistSearching(true);
      try {
        const j = await fetch(`/api/audius/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json());
        if (!alive) return;
        const byHandle = new Map<string, any>();
        for (const track of j.tracks ?? []) {
          const user = track.user;
          if (!user?.handle || byHandle.has(user.handle)) continue;
          const coin = coins.find((c) =>
            c.artist_handle?.toLowerCase() === user.handle.toLowerCase() ||
            c.artist_name?.toLowerCase() === user.name?.toLowerCase(),
          );
          byHandle.set(user.handle, { user, track, coin });
        }
        const ql = q.toLowerCase().replace(/^\$/, "");
        for (const coin of coins) {
          const handle = coin.artist_handle;
          const matched =
            coin.ticker?.toLowerCase().includes(ql) ||
            coin.name?.toLowerCase().includes(ql) ||
            coin.artist_name?.toLowerCase().includes(ql) ||
            handle?.toLowerCase().includes(ql);
          if (!matched) continue;
          const key = handle || coin.owner_id || coin.mint;
          if (byHandle.has(key)) continue;
          byHandle.set(key, {
            user: {
              handle: handle || coin.ticker?.toLowerCase(),
              name: coin.artist_name || coin.name,
              profile_picture: coin.artist_avatar || coin.logo_uri ? { "150x150": coin.artist_avatar || coin.logo_uri } : undefined,
            },
            track: { artwork: { "150x150": coin.logo_uri } },
            coin,
          });
        }
        setArtistResults(Array.from(byHandle.values()).slice(0, 6));
      } catch {
        if (alive) setArtistResults([]);
      } finally {
        if (alive) setArtistSearching(false);
      }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [artistQuery, coins]);

  return (
    <div className="space-y-5">
      {/* ─── Hero Section ──────────────────────────────────── */}
      <section className="relative rounded-2xl md:rounded-3xl overflow-hidden panel-elevated p-5 sm:p-7 md:p-12 2xl:p-14 flex flex-col md:flex-row gap-5 md:gap-8 2xl:gap-12 items-center justify-between grain">
        {/* Ambient lighting */}
        <div className="orb orb-neon w-[500px] h-[500px] -top-40 -right-40 opacity-40" />
        <div className="orb orb-violet w-[400px] h-[400px] -bottom-40 -left-40 opacity-30" style={{ animationDelay: "-10s" }} />
        
        <div className="flex-1 min-w-0 relative z-10 space-y-5 text-center md:text-left">
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.22em] sm:tracking-[0.3em] font-black text-mute mb-3">Live Music Economy</div>
            <div className="relative h-[92px] sm:h-[112px] md:h-[138px]">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={isArtist ? "artist" : heroIdx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex flex-col justify-center text-[2.35rem] sm:text-5xl md:text-6xl font-black tracking-tight leading-[0.9]"
                >
                  {isArtist ? (
                    <>
                      <span className="text-gradient-hero">Launch</span>
                      <span className="text-gradient-violet">& Grow.</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gradient-hero">{hero.a}</span>
                      <span className={hero.color}>{hero.b}</span>
                    </>
                  )}
                </motion.h1>
              </AnimatePresence>
            </div>
          </div>
          <p className="text-mute text-sm sm:text-base md:text-lg max-w-xl font-medium leading-relaxed">
            {isArtist
              ? `Establish your market presence, @${audius?.handle}. Convert streaming engagement into institutional capital.`
              : "Discover breakout artists early. Support their Artist Tokens and Song Tokens, build your reputation, and gain status as they grow."}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 shrink-0 relative z-10 w-full md:w-auto">
            {isArtist && (
              <Link href="/artist" className="w-full sm:w-auto btn-primary px-8 py-3.5 text-[10px] font-black tracking-widest shadow-neon-glow">
                LAUNCH TOKEN
              </Link>
            )}
            {!address && (
              <button
                onClick={openLoginModal}
                className="w-full sm:w-auto btn-primary px-8 py-3.5 text-[10px] font-black tracking-widest shadow-neon-glow"
              >
                CONNECT TO TRADE
              </button>
            )}
            <Link href="/portfolio" className="w-full sm:w-auto btn-glass px-8 py-3.5 text-[10px] uppercase tracking-widest font-black text-center">
              YOUR REPUTATION & PORTFOLIO
            </Link>
          </div>
        </div>

        <div className="hidden lg:block relative z-10 w-[286px] xl:w-[340px] 2xl:w-[380px] shrink-0">
          <div className="panel p-5 rounded-[28px] border border-edge bg-panel2/70 backdrop-blur-3xl grain overflow-hidden relative">
            <div className="absolute inset-x-0 bottom-0 h-16 wave-line opacity-20" />
            <div className="absolute -right-14 -top-14 h-32 w-32 rounded-full bg-neon/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] font-black text-mute">Live Market</div>
                <div className="mt-1 text-xl font-black tracking-tight text-ink">Pulse</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/25 bg-neon/10 px-2.5 py-1 text-[8px] uppercase tracking-widest font-black text-neon">
                <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulseDot" /> Live
              </span>
            </div>
            <div className="relative mt-5 grid gap-3">
              <HeroPulseRow label="Volume" value={fmtUsdCompact(heroPulse.volume)} accent="text-neon" />
              <HeroPulseRow label="Active Artists" value={fmtStatCompact(heroPulse.artists)} />
              <HeroPulseRow label="Songs Tokenized" value={fmtStatCompact(heroPulse.songs)} accent="text-cyan" />
            </div>
            <div className="relative mt-4 flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.18em] font-black text-mute">
              <span>Audius synced</span>
              <span className="text-neon/80">Every 60s</span>
            </div>
          </div>
        </div>
      </section>

      <InfoBanner />

      <AudiencePlaylist />

      {!address && <MarketPrimer onConnect={openLoginModal} />}

      <section className="panel-elevated p-4 grain">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.24em] font-black text-mute mb-2">Audius Artist Lookup</div>
            <input
              value={artistQuery}
              onChange={(e) => setArtistQuery(e.target.value)}
              placeholder="Search any Audius artist or handle..."
              className="w-full h-11 text-sm bg-panel2 border border-edge rounded-xl px-4 text-ink placeholder-mute/70 focus:border-neon/50"
            />
          </div>
          <div className="lg:w-[520px] min-h-[58px] grid grid-cols-1 sm:grid-cols-2 gap-2">
            {artistQuery.trim().length < 2 ? (
              <div className="sm:col-span-2 h-full rounded-xl border border-edge bg-white/[0.045] px-4 py-3 text-xs text-mute flex items-center">
                Search live Audius artists and jump to their Artist Token when one is listed.
              </div>
            ) : artistSearching ? (
              <div className="sm:col-span-2 h-full rounded-xl border border-edge bg-white/[0.045] px-4 py-3 text-xs text-mute flex items-center animate-pulse">
                Searching Audius...
              </div>
            ) : artistResults.length ? artistResults.slice(0, 4).map((r) => {
              const img = r.user?.profile_picture?.["150x150"] || r.track?.artwork?.["150x150"] || r.track?.artwork?.["480x480"] || null;
              const body = (
                <>
                  <span className="relative w-9 h-9 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.05] shrink-0">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink truncate">{r.user?.name || r.user?.handle}</span>
                    <span className="block text-[10px] uppercase tracking-widest text-mute truncate">@{r.user?.handle}</span>
                  </span>
                  <span className={`text-[9px] uppercase tracking-widest font-black rounded-md px-2 py-1 border shrink-0 ${r.coin ? "text-neon bg-neon/10 border-neon/25" : "text-mute bg-white/[0.05] border-edge"}`}>
                    {r.coin ? "Coin Live" : "No Coin"}
                  </span>
                </>
              );
              return r.coin ? (
                <Link key={r.user.handle} href={`/artist/${encodeURIComponent(r.user.handle)}`} className="h-14 rounded-xl border border-edge bg-white/[0.045] hover:bg-white/[0.08] active:scale-[0.99] transition px-3 flex items-center gap-3 text-left">
                  {body}
                </Link>
              ) : (
                <Link key={r.user.handle} href={`/artist/${encodeURIComponent(r.user.handle)}`} className="h-14 rounded-xl border border-edge bg-white/[0.045] hover:bg-white/[0.08] active:scale-[0.99] transition px-3 flex items-center gap-3 text-left">
                  {body}
                </Link>
              );
            }) : (
              <div className="sm:col-span-2 h-full rounded-xl border border-edge bg-white/[0.045] px-4 py-3 text-xs text-mute flex items-center">
                No Audius artists found for that search.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Market Controls ───────────────────────────── */}
      <section className="space-y-2 pb-3 border-b border-edge">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="flex flex-col sm:flex-row gap-2 min-w-0">
            <Segmented
              options={[
                { id: "coins" as Market, label: "Artist Tokens" },
                { id: "songs" as Market, label: "Song Tokens" },
              ]}
              value={market}
              onChange={setMarket}
            />

            <Segmented
              options={market === "coins" ? COIN_SORTS : SONG_SORTS}
              value={market === "coins" ? coinSort : songSort}
              onChange={(v) => market === "coins" ? setCoinSort(v as CoinSort) : setSongSort(v as SongSort)}
            />
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <div className="flex bg-white/[0.055] border border-edge rounded-xl p-0.5">
              {([
                { id: "grid" as const, icon: <LayoutGrid size={12} />, label: "Grid" },
                { id: "list" as const, icon: <List size={12} />, label: "List" },
                { id: "heat" as const, icon: <Flame size={12} />, label: "Heat" },
              ]).map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  title={v.label}
                  className={`w-9 h-8 flex items-center justify-center rounded-lg transition-all ${
                    view === v.id ? "bg-white/[0.1] text-ink" : "text-mute hover:text-ink"
                  }`}
                >
                  {v.icon}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowWatchlistOnly(v => !v)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                showWatchlistOnly
                  ? "bg-gold/10 border-gold/20 text-gold"
                  : "bg-white/[0.045] border-edge text-mute hover:text-ink hover:bg-white/[0.08]"
              }`}
            >
              <Star size={10} fill={showWatchlistOnly ? "currentColor" : "none"} />
              <span className="hidden sm:inline">Watchlist</span>
              {watchlist.items.length > 0 && (
                <span className="text-[9px] bg-white/[0.04] px-1.5 py-0.5 rounded-full">{watchlist.items.length}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center gap-2">
          <div className="flex w-full items-center gap-1.5 flex-wrap pb-1 xl:pb-0">
            {[
              ["all", "All"],
              ["verified", "Verified"],
              ["locked", "Locked"],
              ["lowRisk", "Low Risk"],
              ["rising", "Rising"],
              ["new", "New Launches"],
              ["holders", "Holder Growth"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMarketFilter(id as MarketFilter)}
                className={`shrink-0 min-w-[72px] px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                  marketFilter === id
                    ? "bg-neon/10 border-neon/25 text-neon"
                    : "bg-white/[0.045] border-edge text-mute hover:text-ink hover:bg-white/[0.08]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-full xl:w-auto xl:ml-auto">
            <div className="px-3 py-2 rounded-xl bg-white/[0.055] border border-edge flex items-center justify-center gap-2 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(0,229,114,0.5)] animate-pulseDot" />
              <span className="text-[10px] text-mute uppercase tracking-widest font-black">
                {loading ? "SYNCING..." : market === "coins" ? `${filteredCoins.length} ASSETS` : `${filteredSongs.length} ASSETS`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {address && (
        <>
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
                <Stat k="Listed" v={fmtNum(coins.length)} tooltip="Total number of Artist Tokens currently trading on the exchange." />
                <Stat k="Combined Cap" v={`$${fmtNum(coinTotals.cap)}`} tooltip="The total market capitalization of all Artist Tokens on the network." />
                <Stat k="24h Volume" v={`$${fmtNum(coinTotals.vol)}`} tooltip="Total dollar volume traded across all Artist Tokens in the last 24 hours." />
                <Stat k="Holders" v={fmtNum(coinTotals.holders)} tooltip="Total number of unique wallets holding Artist Tokens across the platform." />
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
                <Stat k="Avg Perf" v={fmtPct((songTotals.avg - 1) * 100)} accent={(songTotals.avg - 1) >= 0 ? "gain" : "lose"} tooltip="Average performance of all song tokens relative to their initial launch price." />
              </motion.section>
            )}
          </AnimatePresence>

          {/* ─── Activity feeds ─────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-3">
            <NewsFeed />
            <TradeFeed />
          </section>
        </>
      )}

      {/* ─── Main Grid ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading && !coins.length && !songs.length ? (
          <CardGridSkeleton key="cards-skel" count={6} />
        ) : market === "coins" ? (
          view === "heat" ? (
            <motion.div key="heat" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <HeatMap coins={filteredCoins} onSelect={(c) => setPreview(c)} />
            </motion.div>
          ) : view === "list" ? (
            <motion.section
              key="coins-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_480px] gap-3 2xl:gap-4"
            >
              <div className="min-w-0 flex flex-col gap-1">
                <div className="hidden md:flex px-6 py-2 items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-mute border-b border-edge">
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
                    onOpen={setPreview}
                  />
                ))}
              </div>
              <div className="hidden md:block xl:sticky xl:top-24 h-fit">
                <HeatMap coins={filteredCoins.slice(0, 18)} onSelect={(c) => setPreview(c)} />
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="coins-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 2xl:gap-4"
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
                    onOpen={setPreview}
                  />
                </motion.div>
              ))}
              {!filteredCoins.length && (
                <div className="md:col-span-2 xl:col-span-3 2xl:col-span-4 panel-elevated p-12 text-center grain">
                  {showWatchlistOnly ? (
                    <>
                      <Star size={32} className="text-mute mx-auto mb-3" />
                      <div className="text-mute text-sm font-bold">Your watchlist is empty</div>
                      <div className="text-mute text-xs mt-1">Star assets to add them to your watchlist</div>
                      <button onClick={() => setShowWatchlistOnly(false)} className="btn mt-4 text-xs">Show All Assets</button>
                    </>
                  ) : (
                    <>
                      <div className="text-mute text-sm font-bold">No Audius coins reachable right now</div>
                      <button onClick={() => setMarket("songs")} className="btn mt-3 text-xs">Browse Artist Tokens instead →</button>
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
            <div className="hidden md:flex px-6 py-2 items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-mute border-b border-edge">
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
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 2xl:gap-4"
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
                    <Star size={32} className="text-mute mx-auto mb-3" />
                    <div className="text-mute text-sm font-bold">No songs in watchlist</div>
                    <button onClick={() => setShowWatchlistOnly(false)} className="btn mt-4 text-xs">Show All</button>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold mb-1 text-ink">No Artist Tokens yet</div>
                    <div className="text-mute text-sm mb-3">Be the first to tokenize your music.</div>
                    {isArtist && <Link href="/artist" className="btn-primary text-xs">+ Launch Artist Token</Link>}
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

      <CoinPreviewModal
        coin={preview}
        isOwner={!!(audius?.userId && preview && audius.userId === preview.owner_id)}
        onClose={() => setPreview(null)}
        onTrade={(side, coin) => setTrade({ side, coin })}
      />

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
