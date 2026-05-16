"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, ExternalLink, Pause, Play, ShieldCheck, Star, X } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { RiskBadge } from "./RiskBadge";
import { PriceChart, type PricePointDTO } from "./PriceChart";
import { usePlayer, useSession, useWatchlist, type PlayerTrack } from "@/lib/store";
import { toast } from "@/lib/toast";
import { CHART_RANGE_LABELS, CHART_RANGES, isFastRange, type ChartRange } from "@/lib/chartRanges";
import { fmtNum, fmtPct } from "@/lib/pricing";
import type { AudiusCoin } from "@/lib/audiusCoins";
import { readJson } from "@/lib/safeJson";
import { useCoins } from "@/lib/useCoins";
import { pickAudiusArtwork } from "@/lib/audiusArtwork";
import { useUsdToDisplayRate } from "@/lib/fiat";
import { AssetSourceBadges } from "@/components/AssetSourceBadges";

interface RecentTradeDTO {
  id: string;
  side: "BUY" | "SELL";
  amount: number;
  priceUsd: number;
  totalUsd: number;
  txSig: string | null;
  createdAt: string;
  wallet: string | null;
  ticker: string;
}

function short(addr: string) {
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function CoinPreviewModal({
  coin,
  isOwner,
  onClose,
  onTrade,
}: {
  coin: AudiusCoin | null;
  isOwner?: boolean;
  onClose: () => void;
  onTrade: (side: "BUY" | "SELL", coin: AudiusCoin) => void;
}) {
  const [points, setPoints] = useState<PricePointDTO[]>([]);
  const [range, setRange] = useState<ChartRange>("1W");
  const [chartType, setChartType] = useState<"line" | "candles">("line");
  const [recentTrades, setRecentTrades] = useState<RecentTradeDTO[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const loadingRef = useRef(false);
  const { current, playing, playTrack, toggle } = usePlayer();
  const { audius } = useSession();
  const watchlist = useWatchlist();
  const { coins: allCoins } = useCoins("marketCap");
  const { formatUsd: formatDisplayFiat } = useUsdToDisplayRate();
  const txPreview = useMemo(() => {
    const sourcePoints = points.length ? points : coin ? [{
      ts: new Date().toISOString(),
      open: coin.price ?? 0,
      high: coin.price ?? 0,
      low: coin.price ?? 0,
      close: coin.price ?? 0,
      volume: 0,
    }] : [];
    if (recentTrades.length) return recentTrades;
    return sourcePoints.slice(-4).reverse().map((p, index) => ({
      id: `${p.ts}-${index}`,
      side: index % 2 === 0 ? "BUY" : "SELL",
      amount: 0,
      priceUsd: p.close,
      totalUsd: 0,
      txSig: null,
      createdAt: typeof p.ts === "string" ? p.ts : p.ts.toISOString(),
      wallet: null,
      ticker: coin?.ticker ?? "",
    }));
  }, [recentTrades, points, coin?.ticker]);

  useEffect(() => {
    if (!coin?.mint) return;
    const selectedCoin = coin;
    let alive = true;
    const load = async () => {
      if (loadingRef.current || document.visibilityState === "hidden") return;
      loadingRef.current = true;
      try {
        const r = await fetch(`/api/coins/${selectedCoin.mint}/history?range=${range}`, { cache: "no-store" });
        const j = await readJson<{ candles?: PricePointDTO[]; trades?: RecentTradeDTO[] }>(r);
        if (alive) {
          setPoints((j?.candles?.length ? j.candles : selectedCoin.price ? [{
            ts: new Date().toISOString(),
            open: selectedCoin.price,
            high: selectedCoin.price,
            low: selectedCoin.price,
            close: selectedCoin.price,
            volume: 0,
          }] : []) as PricePointDTO[]);
          setRecentTrades(j?.trades ?? []);
        }
      } catch {
        if (alive) {
          setPoints(selectedCoin.price ? [{
            ts: new Date().toISOString(),
            open: selectedCoin.price,
            high: selectedCoin.price,
            low: selectedCoin.price,
            close: selectedCoin.price,
            volume: 0,
          }] : []);
          setRecentTrades([]);
        }
      } finally {
        loadingRef.current = false;
      }
    };
    load();
    const i = setInterval(load, isFastRange(range) ? 5_000 : 15_000);
    return () => { alive = false; clearInterval(i); };
  }, [coin?.mint, range]);

  useEffect(() => {
    if (!coin?.artist_handle) { setTracks([]); return; }
    let alive = true;
    fetch(`/api/audius/tracks?handle=${encodeURIComponent(coin.artist_handle)}`, { cache: "no-store" })
      .then((r) => r.ok ? readJson<{ tracks?: any[] }>(r) : { tracks: [] })
      .then((j) => { if (alive) setTracks(j?.tracks ?? []); })
      .catch(() => { if (alive) setTracks([]); });
    return () => { alive = false; };
  }, [coin?.artist_handle]);

  useEffect(() => {
    if (!coin) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [coin]);

  if (!coin) return null;
  const activeCoin = coin;
  const isOpenAudio = Boolean(activeCoin.isOpenAudioCoin || activeCoin.source === "open_audio" || activeCoin.source === "audius_public");
  const isSongDaqLocal = !isOpenAudio && Boolean(activeCoin.isSongDaqLocal || activeCoin.songId || activeCoin.mintAddress);
  const artistVerified = Boolean(activeCoin.audiusVerified || activeCoin.songDaqVerified);
  const assetLabel = isSongDaqLocal ? "SONG·DAQ Song Coin" : "Open Audio Artist Coin";
  const signedInArtistOwnsCoin = Boolean(
    isOwner ||
    (audius?.userId && (
      String(audius.userId) === String(activeCoin.owner_id ?? "") ||
      String(audius.userId) === String((activeCoin as any).artistWallet?.audiusUserId ?? "")
    )) ||
    (audius?.handle && activeCoin.artist_handle && audius.handle.toLowerCase() === activeCoin.artist_handle.toLowerCase())
  );
  const chartPoints = points.length ? points : coin.price ? [{
    ts: new Date().toISOString(),
    open: coin.price,
    high: coin.price,
    low: coin.price,
    close: coin.price,
    volume: 0,
  }] : [];

  const change = activeCoin.priceChange24hPercent ?? 0;
  const audioUrl = activeCoin.audius_track_id ? `https://api.audius.co/v1/tracks/${activeCoin.audius_track_id}/stream?app_name=songdaq` : null;
  const playerTrack: PlayerTrack | null = audioUrl ? {
    id: String(activeCoin.audius_track_id),
    title: activeCoin.audius_track_title ?? activeCoin.name,
    artist: activeCoin.artist_name ?? activeCoin.name,
    artwork: activeCoin.audius_track_artwork ?? activeCoin.logo_uri ?? null,
    streamUrl: audioUrl,
    href: `/coin/${activeCoin.mint}`,
  } : null;
  const isPlayingThis = !!playerTrack && current?.id === playerTrack.id && playing;
  const watched = watchlist.items.includes(coin.mint);
  const primaryLinkedTrack = activeCoin.audius_track_id || activeCoin.audius_track_title
    ? {
        id: activeCoin.audius_track_id || `song-daq-${activeCoin.songId || activeCoin.mint}`,
        title: activeCoin.audius_track_title || activeCoin.name,
        artwork: activeCoin.audius_track_artwork || activeCoin.logo_uri || activeCoin.artist_avatar || null,
        play_count: activeCoin.audius_play_count ?? 0,
        streamUrl: activeCoin.audius_track_id ? `https://api.audius.co/v1/tracks/${activeCoin.audius_track_id}/stream?app_name=songdaq` : "",
        user: { name: activeCoin.artist_name || activeCoin.name },
        songDaqLinkedCoin: true,
      }
    : null;
  const visibleTracks = [
    ...(primaryLinkedTrack ? [primaryLinkedTrack] : []),
    ...tracks.filter((track) => {
      const trackId = String(track?.id ?? "");
      const trackTitle = String(track?.title ?? "").trim().toLowerCase();
      if (primaryLinkedTrack && trackId && trackId === String(primaryLinkedTrack.id)) return false;
      if (primaryLinkedTrack && trackTitle && trackTitle === String(primaryLinkedTrack.title).trim().toLowerCase()) return false;
      return true;
    }),
  ].slice(0, 5);
  const linkedTrackCount = visibleTracks.filter((track) => !!linkedCoinForTrack(track)).length;
  const linkedSongSnapshot = activeCoin.audius_track_title
    ? `1 linked · ${activeCoin.audius_track_title}`
    : linkedTrackCount > 0
      ? `${linkedTrackCount}/${visibleTracks.length || linkedTrackCount} linked`
      : "No linked song yet";
  const activeSide = Number(coin.buy24h ?? 0) >= Number(coin.sell24h ?? 0) ? "Buy pressure" : "Sell pressure";
  const royaltyStatus = (coin as any).splitsLocked ? "Royalty split locked" : "Royalty pending";
  const marketValueReliable = !isSongDaqLocal || (coin as any).isMarketValueReliable !== false;
  const marketValueLabel = marketValueReliable && Number(coin.marketCap ?? 0) > 0 ? formatDisplayFiat(coin.marketCap ?? 0, 0) : "Not priced yet";
  const tradableSupply = Number((coin as any).tradableSupply ?? coin.circulatingSupply ?? 0);

  function trackToPlayerTrack(track: any): PlayerTrack {
    const artwork = pickAudiusArtwork(
      track,
      activeCoin.audius_track_artwork ?? activeCoin.logo_uri ?? activeCoin.artist_avatar ?? null,
    );
    return {
      id: `audius-track-${track.id}`,
      title: track.title ?? "Untitled",
      artist: track.user?.name ?? activeCoin.artist_name ?? activeCoin.name,
      artwork,
      streamUrl: track.streamUrl || `https://api.audius.co/v1/tracks/${track.id}/stream?app_name=songdaq`,
      href: track.permalink ?? (activeCoin.artist_handle ? `https://audius.co/${activeCoin.artist_handle}` : undefined),
    };
  }

  function linkedCoinForTrack(track: any) {
    const title = String(track.title ?? "").trim().toLowerCase();
    const trackId = String(track.id ?? "");
    const activeTrackId = String(activeCoin.audius_track_id ?? "");
    const activeTrackTitle = String(activeCoin.audius_track_title ?? "").trim().toLowerCase();
    if ((activeTrackId && trackId === activeTrackId) || (activeTrackTitle && title === activeTrackTitle) || track.songDaqLinkedCoin) {
      return activeCoin;
    }
    return allCoins.find((item) => {
      if (item.audius_track_id && String(item.audius_track_id) === trackId) return true;
      return !!title
        && String(item.audius_track_title ?? "").trim().toLowerCase() === title
        && String(item.artist_handle ?? "").trim().toLowerCase() === String(activeCoin.artist_handle ?? "").trim().toLowerCase();
    });
  }

  function createSongCoinHref(track: any) {
    const params = new URLSearchParams();
    const trackId = String(track?.id ?? "");
    if (trackId && !trackId.startsWith("song-daq-")) params.set("trackId", trackId);
    const trackTitle = String(track?.title ?? "");
    if (trackTitle) params.set("trackTitle", trackTitle);
    if (activeCoin.artist_handle) params.set("artist", activeCoin.artist_handle);
    return `/artist?${params.toString()}`;
  }

  function toggleTrack(track: any) {
    const next = trackToPlayerTrack(track);
    if (current?.id === next.id) toggle();
    else playTrack(next);
  }

  function toggleAudio() {
    if (!playerTrack) {
      toast.info("Audio unavailable.", "This coin does not have an Audius preview attached yet.");
      return;
    }
    if (current?.id === playerTrack.id) toggle();
    else playTrack(playerTrack);
  }

  function trade(side: "BUY" | "SELL") {
    onClose();
    onTrade(side, activeCoin);
  }

  function copyMint() {
    navigator.clipboard.writeText(activeCoin.mint).then(() => toast.success("Mint copied", short(activeCoin.mint))).catch(() => {});
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="mobile-safe-overlay fixed inset-0 z-[9500] grid items-start justify-items-center overflow-y-auto bg-pure-black/70 backdrop-blur-xl sm:place-items-center overscroll-contain"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
          className="mobile-safe-sheet w-full max-w-full sm:w-[min(1220px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl sm:rounded-3xl border border-edge bg-panel text-ink shadow-[0_24px_90px_rgba(0,0,0,0.62)] grain"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-x-0 top-0 h-28 wave-line" />
          <header className="relative flex flex-col gap-4 border-b border-edge p-4 pr-14 sm:p-5 sm:pr-14 sm:flex-row sm:items-start">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-edge bg-panel2 shadow-depth sm:h-24 sm:w-24">
              <SafeImage src={coin.logo_uri} alt={coin.ticker} fill sizes="96px" fallback={coin.ticker} className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-ink">${coin.ticker}</div>
                <span className={`rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-widest font-black ${
                  isSongDaqLocal ? "border-neon/20 bg-neon/10 text-neon" : "border-violet/20 bg-violet/10 text-violet"
                }`}>{assetLabel}</span>
                <RiskBadge coin={coin as any} compact />
                <span className="rounded-md border border-violet/20 bg-violet/10 px-2 py-0.5 text-[11px] uppercase tracking-widest font-black text-violet">
                  {isSongDaqLocal ? "Created on SONG·DAQ" : "Imported public market"}
                </span>
                <AssetSourceBadges asset={coin as any} compact />
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-mute whitespace-normal break-words">
                {coin.artist_name ?? coin.name}{coin.artist_handle ? ` · @${coin.artist_handle}` : ""}
              </div>
              {coin.audius_track_title ? (
                <div className="mt-2 text-[11px] uppercase tracking-widest text-mute whitespace-normal break-words">
                  {coin.audius_track_title} · {fmtNum(coin.audius_play_count ?? 0)} plays
                </div>
              ) : (
                <div className="mt-2 text-[11px] uppercase tracking-widest text-mute">No song preview attached</div>
              )}
              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-mono font-black">{formatDisplayFiat(coin.price ?? 0, 6)}</span>
                <span className={`num text-sm font-black ${change >= 0 ? "text-neon" : "text-red"}`}>
                  {change >= 0 ? "+" : ""}{fmtPct(change)} 24h
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-panel2 px-2.5 py-1 text-[11px] uppercase tracking-widest font-black text-mute">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulseDot" /> Live
                </span>
              </div>
            </div>
            <button onClick={onClose} className="absolute right-4 top-4 h-9 w-9 rounded-xl border border-edge bg-panel2 text-mute hover:text-ink hover:bg-white/10 transition grid place-items-center">
              <X size={15} />
            </button>
          </header>

          <section className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0 border-b border-edge p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="text-[11px] uppercase tracking-widest font-black text-mute">
                  Timeframe: <span className="text-neon">{CHART_RANGE_LABELS[range]}</span>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-2">
                  <div className="flex max-w-full gap-1 overflow-x-auto no-scrollbar rounded-xl border border-edge bg-panel2 p-1">
                    {CHART_RANGES.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition ${
                          range === r ? "bg-neon/15 text-neon border border-neon/25" : "text-mute hover:text-ink hover:bg-white/10"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="flex rounded-xl border border-edge bg-panel2 p-1 text-[11px] font-black uppercase tracking-widest">
                    {(["candles", "line"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setChartType(mode)}
                        className={`rounded-lg px-2.5 py-1.5 transition ${
                          chartType === mode ? "bg-white/10 text-ink" : "text-mute hover:text-ink"
                        }`}
                      >
                        {mode === "candles" ? "Candles" : "Line"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-[320px] overflow-hidden rounded-2xl border border-edge bg-panel2/60 p-2 sm:h-[360px] lg:h-[390px]">
                <PriceChart
                  points={chartPoints}
                  quote="USD"
                  height={340}
                  chartType={chartType}
                  live={isFastRange(range)}
                  mode="advanced"
                  showVolume
                  showMA7={false}
                  showMA25={false}
                  variant="investing"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Public Value" value={marketValueLabel} />
                <Metric label="Volume" value={formatDisplayFiat(coin.v24hUSD ?? 0, 0)} />
                <Metric label="Holders" value={fmtNum(coin.holder ?? 0)} />
                <Metric label="Liquidity" value={formatDisplayFiat(coin.liquidity ?? 0, 0)} />
                <Metric label="Supply" value={fmtNum(coin.totalSupply ?? 0)} />
                <Metric label="Tradable" value={tradableSupply > 0 ? fmtNum(tradableSupply) : "Pending"} />
                <Metric label="Markets" value={String((coin as any).numberMarkets ?? 1)} />
                <Metric label="Royalty" value={(coin as any).splitsLocked ? "Locked" : "Pending"} accent={(coin as any).splitsLocked ? "text-neon" : "text-amber"} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <InsightCard
                  label="Why This Coin Exists"
                  value={coin.audius_track_title || "Artist market coin"}
                  body={isSongDaqLocal
                    ? "This coin was created through SONG·DAQ and is tied to this artist/song setup in your app."
                    : coin.audius_track_title
                    ? "This coin is connected to an Audius song signal, artist profile, and live Solana token market."
                    : "This is an artist token. The artist's songs below show what already has a linked coin and what does not yet."}
                />
                <InsightCard
                  label="Market Pulse"
                  value={activeSide}
                  body={`${fmtNum(coin.trade24h ?? 0)} trades today · ${fmtNum(coin.uniqueWallet24h ?? 0)} active wallets · ${formatDisplayFiat(coin.v24hUSD ?? 0, 0)} volume.`}
                />
                <InsightCard
                  label="Royalty Signal"
                  value={royaltyStatus}
                  body={(coin as any).splitsLocked
                    ? "Royalty split status is marked locked for this token."
                    : "Royalty verification is not locked yet, so treat royalty backing as unverified."}
                />
              </div>
            </div>

            <aside className="min-w-0 bg-panel2/60 p-4 sm:p-5 space-y-4">
              <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-edge bg-panel2">
                    <SafeImage src={coin.artist_avatar ?? coin.logo_uri} alt={coin.artist_name ?? coin.name} fill sizes="56px" fallback={coin.ticker} className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-widest font-black text-mute">Artist Profile</div>
                    <div className="mt-1 text-sm font-black text-ink whitespace-normal break-words">{coin.artist_name ?? coin.name}</div>
                    {coin.artist_handle ? <div className="mt-0.5 text-[11px] font-bold text-violet">@{coin.artist_handle}</div> : null}
                  </div>
                </div>
                {coin.description ? (
                  <p className="mt-3 text-xs leading-relaxed text-mute">{coin.description}</p>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-mute">Artist profile, token market data, music preview, and linked song activity are shown here before you trade.</p>
                )}
              </div>

              <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className="mb-3 text-[11px] uppercase tracking-widest font-black text-mute">Coin Snapshot</div>
                <div className="grid gap-2">
                  <SnapshotRow label="Token" value={`$${coin.ticker}`} />
                  <SnapshotRow label="Artist" value={coin.artist_name ?? coin.name} />
                  <SnapshotRow label="Linked song" value={linkedSongSnapshot} />
                  <SnapshotRow label="24h buys" value={fmtNum(coin.buy24h ?? 0)} />
                  <SnapshotRow label="24h sells" value={fmtNum(coin.sell24h ?? 0)} />
                  <SnapshotRow label="Wallets today" value={fmtNum(coin.uniqueWallet24h ?? 0)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary h-11 text-[11px] font-black uppercase tracking-widest" onClick={() => trade("BUY")}>Buy</button>
                <button className="btn h-11 text-[11px] font-black uppercase tracking-widest" onClick={() => trade("SELL")}>Sell</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn h-10 text-[11px] uppercase tracking-widest font-black"
                  onClick={toggleAudio}
                >
                  {isPlayingThis ? <Pause size={13} /> : <Play size={13} />}
                  {isPlayingThis ? "Pause" : "Play"}
                </button>
                <button
                  className={`btn h-10 text-[11px] uppercase tracking-widest font-black ${watched ? "text-gold border-gold/30" : ""}`}
                  onClick={() => watchlist.toggle(coin.mint)}
                >
                  <Star size={13} fill={watched ? "currentColor" : "none"} />
                  {watched ? "Watching" : "Watch"}
                </button>
              </div>

              <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-widest font-black text-mute">Issuer Discography</div>
                  <span className="text-[11px] uppercase tracking-widest font-black text-neon">{visibleTracks.length || 0} tracks</span>
                </div>
                <div className="space-y-2">
                  {visibleTracks.length ? visibleTracks.map((track) => {
                    const linked = linkedCoinForTrack(track);
                    const player = trackToPlayerTrack(track);
                    const isTrackPlaying = current?.id === player.id && playing;
                    return (
                      <div key={String(track.id)} className="rounded-xl border border-edge bg-panel2/70 p-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-edge bg-panel">
                            <SafeImage src={player.artwork} alt={player.title} fill sizes="40px" fallback={coin.ticker} className="object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-black text-ink">{player.title}</div>
                            <div className="mt-0.5 text-[11px] uppercase tracking-widest text-mute">{fmtNum(track.play_count ?? 0)} plays</div>
                          </div>
                          <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-black uppercase tracking-widest ${linked ? "border-neon/25 bg-neon/10 text-neon" : "border-edge bg-panel text-mute"}`}>
                            {linked ? "Coin On" : "No Coin"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button className="btn h-10 px-2.5 text-[11px] uppercase tracking-widest font-black" onClick={() => toggleTrack(track)}>
                            {isTrackPlaying ? <Pause size={12} /> : <Play size={12} />}
                            {isTrackPlaying ? "Pause" : "Play"}
                          </button>
                          {linked ? (
                            <Link href={`/coin/${linked.mint}`} className="btn h-10 px-2.5 text-[11px] uppercase tracking-widest font-black">
                              Open Coin
                            </Link>
                          ) : signedInArtistOwnsCoin ? (
                            <Link href={createSongCoinHref(track)} className="btn-primary h-10 px-2.5 text-[11px] uppercase tracking-widest font-black">
                              Create Coin
                            </Link>
                          ) : (
                            <span className="inline-flex h-10 items-center rounded-lg border border-edge bg-panel px-2.5 text-[11px] uppercase tracking-widest font-black text-mute">
                              No Coin Yet
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-xl border border-edge bg-panel2/70 p-3 text-xs text-mute">
                      No Audius discography loaded yet for this artist.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-edge bg-panel p-4 space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-mute">
                  <ShieldCheck size={13} className="text-neon" />
                  Security & Trust
                </div>
                <div className="grid gap-2 text-[11px] text-mute">
                  <div className="mb-1">
                    <AssetSourceBadges asset={coin as any} compact />
                  </div>
                  <TrustLine ok label="Solana SPL token" />
                  <TrustLine ok={!!coin.artist_handle} label={coin.artist_handle ? "Audius artist resolved" : "Audius profile pending"} />
                  <TrustLine ok={artistVerified} label={artistVerified ? "Verified artist via Audius" : "Artist verification pending"} />
                  <TrustLine ok={(coin as any).splitsLocked} label={(coin as any).splitsLocked ? "Royalty splits locked" : "Royalty splits pending"} />
                </div>
              </div>

              <div className="rounded-2xl border border-edge bg-panel p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-widest font-black text-mute">Contract Preview</div>
                <button onClick={copyMint} className="w-full rounded-xl border border-edge bg-panel2 p-3 text-left font-mono text-xs text-ink hover:border-neon/30 transition flex items-center justify-between gap-2">
                  <span className="truncate">{short(coin.mint)}</span>
                  <Copy size={13} className="text-mute" />
                </button>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/coin/${coin.mint}`} className="btn h-9 px-3 text-[11px] uppercase tracking-widest font-black">
                    <ExternalLink size={13} /> Full page
                  </Link>
                  {coin.artist_handle && (
                    <a href={`https://audius.co/${coin.artist_handle}`} target="_blank" rel="noreferrer" className="btn h-9 px-3 text-[11px] uppercase tracking-widest font-black">
                      Audius
                    </a>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className="mb-3 text-[11px] uppercase tracking-widest font-black text-mute">Recent Movement</div>
                <div className="space-y-2">
                  {txPreview.length ? txPreview.map((p, i) => (
                    <div key={`${p.id ?? p.createdAt}-${i}`} className="rounded-xl border border-edge bg-panel2/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-widest font-black text-mute">
                            {new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </div>
                          <div className={`mt-1 text-[11px] uppercase tracking-widest font-black ${p.side === "BUY" ? "text-neon" : "text-red"}`}>
                            {p.side} {p.amount ? `${fmtNum(p.amount)} ${coin.ticker}` : coin.ticker}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-ink">{formatDisplayFiat(p.priceUsd, 6)}</div>
                          {p.totalUsd ? <div className="text-[11px] uppercase tracking-widest text-mute font-black">{formatDisplayFiat(p.totalUsd, 2)}</div> : null}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {p.txSig ? (
                          <a
                            href={`https://solscan.io/tx/${p.txSig}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-neon/20 bg-neon/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-neon hover:bg-neon/15 transition"
                          >
                            Solscan Tx
                          </a>
                        ) : (
                          <a
                            href={`/coin/${coin.mint}`}
                            className="rounded-lg border border-edge bg-panel px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-ink hover:bg-panel transition"
                          >
                            Coin Page
                          </a>
                        )}
                        {p.wallet ? (
                          <a
                            href={`https://solscan.io/account/${p.wallet}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-edge bg-panel px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-ink hover:bg-panel transition"
                          >
                            Wallet
                          </a>
                        ) : null}
                      </div>
                    </div>
                  )) : (
                    <div className="text-xs text-mute">Building price history</div>
                  )}
                </div>
              </div>
            </aside>
          </section>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3 min-w-0">
      <div className="text-[11px] uppercase tracking-widest text-mute font-black truncate">{label}</div>
      <div className={`mt-1 font-mono font-bold text-ink truncate ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function InsightCard({ label, value, body }: { label: string; value: string; body: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[11px] uppercase tracking-widest text-mute font-black">{label}</div>
      <div className="mt-1 text-sm font-black text-ink break-words">{value}</div>
      <p className="mt-2 text-[11px] leading-relaxed text-mute">{body}</p>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-panel2/70 px-3 py-2 text-xs">
      <span className="text-[11px] uppercase tracking-widest text-mute font-black">{label}</span>
      <span className="min-w-0 truncate text-right font-mono font-black text-ink">{value}</span>
    </div>
  );
}

function TrustLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-neon shadow-[0_0_8px_rgba(198,255,0,0.6)]" : "bg-amber"}`} />
    </div>
  );
}
