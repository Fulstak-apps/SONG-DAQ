"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { Star, Rocket, Play, Pause } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { Sparkline } from "./Sparkline";
import { Tooltip } from "./Tooltip";
import { fmtNum, fmtPct } from "@/lib/pricing";
import { usePlayer, useWatchlist, type PlayerTrack } from "@/lib/store";
import { toast } from "@/lib/toast";
import { RiskBadge } from "./RiskBadge";
import type { AudiusCoin } from "@/lib/audiusCoins";
import { useUsdToDisplayRate } from "@/lib/fiat";

/* Prestige tier based on market cap */
function getTier(cap: number): { label: string; color: string; glow: string } {
  if (cap >= 10_000_000) return { label: "PLATINUM", color: "text-platinum border-platinum/30 bg-platinum/8", glow: "shadow-[0_0_12px_rgba(229,228,226,0.15)]" };
  if (cap >= 1_000_000) return { label: "GOLD", color: "text-gold border-gold/30 bg-gold/8", glow: "shadow-[0_0_12px_rgba(212,175,55,0.15)]" };
  if (cap >= 100_000) return { label: "SILVER", color: "text-silver border-silver/30 bg-silver/8", glow: "" };
  if (cap >= 10_000) return { label: "BRONZE", color: "text-bronze border-bronze/30 bg-bronze/8", glow: "" };
  return { label: "", color: "", glow: "" };
}

export function CoinCard({
  c,
  isOwner,
  onTrade,
  onOpen,
}: {
  c: AudiusCoin;
  isOwner?: boolean;
  onTrade?: (side: "BUY" | "SELL", c: AudiusCoin) => void;
  onOpen?: (c: AudiusCoin) => void;
}) {
  const router = useRouter();
  const watchlist = useWatchlist();
  const { current, playing, playTrack, toggle } = usePlayer();
  const { formatUsd: formatDisplayFiat } = useUsdToDisplayRate();
  const isWatched = watchlist.items.includes(c.mint);

  const change = c.priceChange24hPercent ?? 0;
  const spark = c.sparkline ?? [];
  const sparkUp = spark.length >= 2 ? spark[spark.length - 1] >= spark[0] : change >= 0;
  const sparkColor = sparkUp ? "#00E572" : "#FF3366";
  const tier = getTier(c.marketCap ?? 0);
  const artwork = c.logo_uri || c.audius_track_artwork || c.artist_avatar || (c.mint ? `/api/token-image/${c.mint}` : null);
  const isOpenAudio = Boolean(c.isOpenAudioCoin || c.source === "open_audio" || c.source === "audius_public");
  const isSongDaqLocal = !isOpenAudio && Boolean(c.isSongDaqLocal || c.songId || c.mintAddress);
  const marketValueReliable = !isSongDaqLocal || (c as any).isMarketValueReliable !== false;
  const marketValueLabel = marketValueReliable && Number(c.marketCap ?? 0) > 0 ? formatDisplayFiat(c.marketCap ?? 0, 0) : "Not priced";
  const assetLabel = isSongDaqLocal ? "song-daq Song Coin" : "Open Audio Artist Coin";
  const sourceHelp = isSongDaqLocal
    ? "This coin was created through song-daq."
    : "This is a public Audius/Open Audio market coin imported from the public coin index. It was not minted by a user on song-daq.";

  const trackTitle = c.audius_track_title ?? null;
  const audioUrl = c.audius_track_id ? `https://api.audius.co/v1/tracks/${c.audius_track_id}/stream?app_name=songdaq` : null;
  const playerTrack = useMemo<PlayerTrack | null>(() => audioUrl && c.audius_track_id ? ({
    id: String(c.audius_track_id),
    title: c.audius_track_title ?? c.name,
    artist: c.artist_name ?? c.name,
    artwork: c.audius_track_artwork ?? artwork,
    streamUrl: audioUrl,
    href: `/coin/${c.mint}`,
  }) : null, [audioUrl, c]);
  const isPlayingThis = !!playerTrack && current?.id === playerTrack.id && playing;

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!playerTrack) {
      toast.info("Audio unavailable.", "This coin does not have an Audius preview attached yet.");
      return;
    }
    if (current?.id === playerTrack.id) toggle();
    else playTrack(playerTrack);
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`panel panel-hover flex min-h-[360px] w-full flex-col gap-4 p-4 text-left cursor-pointer relative overflow-hidden grain sm:p-5 xl:min-h-[372px] ${tier.glow}`}
      onClick={() => onOpen ? onOpen(c) : router.push(`/coin/${c.mint}`)}
    >
      {/* Ambient glow */}
      <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-[60px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${sparkUp ? "bg-neon/10" : "bg-red/10"}`} />
      <div className="absolute inset-x-0 bottom-16 h-12 wave-line opacity-20" />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-edge bg-panel2 shadow-depth shrink-0">
            <SafeImage src={artwork} alt={c.ticker} fill sizes="48px" className="object-cover" fallback={c.ticker} />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/5 pointer-events-none" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-base text-ink tracking-tight break-words">${c.ticker}</span>
              {tier.label && (
                <span className={`text-[11px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${tier.color}`}>
                  {tier.label}
                </span>
              )}
              {isOwner && (
                <Tooltip content="This is your launched Artist Token. As the creator, you cannot trade your own coin.">
                  <span className="chip-violet text-[11px]">Issuer</span>
                </Tooltip>
              )}
              <RiskBadge coin={c as any} compact />
              <Tooltip content={sourceHelp}>
                <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-black uppercase tracking-widest ${
                  isSongDaqLocal ? "border-neon/25 bg-neon/10 text-neon" : "border-violet/25 bg-violet/10 text-violet"
                }`}>
                  {isSongDaqLocal ? "song-daq" : "Open Audio"}
                </span>
              </Tooltip>
            </div>
            <div className="text-[11px] text-mute line-clamp-2 uppercase tracking-widest font-bold mt-1 leading-snug">
              {c.artist_name ? <>{c.artist_name}{c.artist_handle ? ` · @${c.artist_handle}` : ""}</> : c.name}
            </div>
          </div>
        </div>

        {/* Watchlist star */}
        <button
          onClick={(e) => { e.stopPropagation(); watchlist.toggle(c.mint); }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0 ${
            isWatched
              ? "bg-gold/10 text-gold border border-gold/20"
              : "bg-white/[0.055] text-mute border border-edge hover:text-ink hover:bg-white/[0.1]"
          }`}
        >
          <Star size={12} fill={isWatched ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Track info: fixed height so Artist Coins and Song Coins align. */}
      <div className="flex h-5 items-center gap-2 px-1">
        {trackTitle ? (
          <>
          <span className="text-violet animate-pulseDot text-xs">♪</span>
          <span className="text-[11px] text-mute truncate uppercase tracking-widest font-bold">{trackTitle}</span>
          {c.audius_play_count ? <span className="shrink-0 text-[11px] text-mute font-mono">· {fmtNum(c.audius_play_count)}</span> : null}
          </>
        ) : (
          <>
            <span className="text-neon text-xs">◌</span>
            <span className="text-[11px] text-mute truncate uppercase tracking-widest font-bold">Audio preview unavailable</span>
          </>
        )}
      </div>

      <Tooltip
        width={340}
        content={
          <div className="space-y-2 text-[12px] leading-relaxed text-mute">
            <div><span className="font-black text-neon">Price:</span> what one coin costs right now.</div>
            <div><span className="font-black text-neon">Public value:</span> coin price multiplied by the public tradable supply, not the whole minted supply.</div>
            <div><span className="font-black text-neon">Holders:</span> wallets that currently hold the coin.</div>
            <div><span className="font-black text-neon">Liquidity:</span> the public market money that lets fans buy and sell.</div>
          </div>
        }
      >
          <span className="w-fit rounded-full border border-edge bg-white/[0.045] px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-mute transition hover:border-neon/30 hover:text-neon">
          What does this mean?
        </span>
      </Tooltip>

      {/* Price + Sparkline row */}
      <div className="flex flex-1 items-end justify-between gap-4 pt-1">
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-black tracking-tighter text-ink uppercase flex items-center gap-2 mb-2">
            <Rocket className="text-neon" size={14} />
            {assetLabel}
          </h2>
          <span className="text-[11px] text-mute uppercase tracking-widest font-black mb-1">Price</span>
          <span className="num text-xl font-black tracking-tight text-ink">{formatDisplayFiat(c.price ?? 0, 6)}</span>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] text-mute uppercase tracking-widest font-bold">
              Public <span className="text-ink ml-1">{marketValueLabel}</span>
            </span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/[0.06]" />
            <span className="text-[11px] text-mute uppercase tracking-widest font-bold">
              Vol <span className="text-ink ml-1">{formatDisplayFiat(c.v24hUSD ?? 0, 0)}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="w-24 h-10 opacity-50 group-hover:opacity-100 transition-opacity">
            <Sparkline data={spark.length ? spark : [0, 0]} color={sparkColor} />
          </div>
          <span className={`num text-[11px] px-2.5 py-1 rounded-lg font-black tracking-wider ${
            change >= 0
              ? "bg-neon/8 text-neon border border-neon/15"
              : "bg-red/8 text-red border border-red/15"
          }`}>
            {change >= 0 ? "▲" : "▼"} {fmtPct(change)}
          </span>
        </div>
      </div>

      {/* Holders + Stream row */}
        <div className="flex items-center justify-between pt-2 border-t border-edge min-h-[40px]">
          <span className="text-[11px] text-mute uppercase tracking-widest font-bold">
            {c.holder ?? 0} Holders
          </span>
          <button
            onClick={togglePlay}
            className={`flex h-10 min-w-[92px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all shadow-sm ${
              isPlayingThis
                ? "bg-violet/20 border-violet/35 text-violet"
                : playerTrack
                  ? "bg-neon/10 border-neon/25 text-neon hover:bg-neon/20 hover:border-neon/40"
                  : "bg-white/[0.055] border-edge text-mute hover:text-ink hover:bg-white/[0.1]"
            }`}
          >
            {isPlayingThis ? <Pause size={13} /> : <Play size={13} />}
            {isPlayingThis ? "Pause" : "Play"}
          </button>
        </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          className="btn-primary flex-1 h-10 text-[11px] font-black uppercase tracking-widest"
          onClick={(e) => { e.stopPropagation(); onTrade?.("BUY", c); }}
        >Buy</button>
        <button
          className="btn h-10 px-5 text-[11px] font-black uppercase tracking-widest hover:bg-red/8 hover:text-red hover:border-red/20"
          onClick={(e) => { e.stopPropagation(); onTrade?.("SELL", c); }}
        >Sell</button>
      </div>
    </motion.div>
  );
}

export function CoinListRow({
  c,
  isOwner,
  onTrade,
  onOpen,
}: {
  c: AudiusCoin;
  isOwner?: boolean;
  onTrade?: (side: "BUY" | "SELL", c: AudiusCoin) => void;
  onOpen?: (c: AudiusCoin) => void;
}) {
  const router = useRouter();
  const watchlist = useWatchlist();
  const { formatUsd: formatDisplayFiat } = useUsdToDisplayRate();
  const change = c.priceChange24hPercent ?? 0;
  const tier = getTier(c.marketCap ?? 0);
  const artwork = c.logo_uri || c.audius_track_artwork || c.artist_avatar || (c.mint ? `/api/token-image/${c.mint}` : null);
  const isOpenAudio = Boolean(c.isOpenAudioCoin || c.source === "open_audio" || c.source === "audius_public");
  const isSongDaqLocal = !isOpenAudio && Boolean(c.isSongDaqLocal || c.songId || c.mintAddress);
  const marketValueReliable = !isSongDaqLocal || (c as any).isMarketValueReliable !== false;
  const marketValueLabel = marketValueReliable && Number(c.marketCap ?? 0) > 0 ? formatDisplayFiat(c.marketCap ?? 0, 0) : "Not priced";

  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={() => onOpen ? onOpen(c) : router.push(`/coin/${c.mint}`)}
      className="panel relative grid cursor-pointer gap-3 p-3 transition-all duration-300 hover:bg-white/[0.07] group md:flex md:flex-nowrap md:items-center md:gap-4"
    >
      {/* Watchlist */}
      <button
        onClick={(e) => { e.stopPropagation(); watchlist.toggle(c.mint); }}
        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-edge bg-panel2 transition-all md:static md:h-6 md:w-6 md:border-0 md:bg-transparent ${
          watchlist.items.includes(c.mint) ? "text-gold" : "text-mute hover:text-ink"
        }`}
        aria-label={watchlist.items.includes(c.mint) ? "Remove from watchlist" : "Add to watchlist"}
      >
        <Star size={10} fill={watchlist.items.includes(c.mint) ? "currentColor" : "none"} />
      </button>

      <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-start gap-3 pr-11 md:flex md:flex-1 md:items-center md:gap-3 md:pr-0">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-edge bg-panel2 md:h-9 md:w-9 md:rounded-lg">
          <SafeImage src={artwork} alt={c.ticker} fill sizes="48px" className="object-cover" fallback={c.ticker} />
        </div>
        <div className="min-w-0 md:min-w-[160px] md:flex-1">
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <span className="font-bold text-base tracking-tight text-ink transition group-hover:text-neon md:text-sm">${c.ticker}</span>
          <RiskBadge coin={c as any} compact />
          <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-black uppercase tracking-widest ${
            isSongDaqLocal ? "border-neon/25 bg-neon/10 text-neon" : "border-violet/25 bg-violet/10 text-violet"
          }`}>
            {isSongDaqLocal ? "song-daq" : "Open Audio"}
          </span>
          {tier.label && <span className={`text-[11px] font-black uppercase tracking-widest px-1 py-0.5 rounded border ${tier.color}`}>{tier.label}</span>}
            <span className="text-[11px] text-mute uppercase tracking-widest font-bold">{c.holder ?? 0} holders</span>
          </div>
          <div className="mt-0.5 text-[12px] font-bold uppercase tracking-widest text-mute line-clamp-2 md:truncate md:text-[11px]">{c.artist_name || c.name}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:contents">
        <div className="rounded-xl border border-edge bg-white/[0.035] px-3 py-2 text-left md:w-28 md:border-0 md:bg-transparent md:p-0 md:text-right">
          <div className="num text-sm font-bold tracking-wider text-ink md:text-xs">{marketValueLabel}</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-widest text-mute">Public Value</div>
        </div>
        <div className="rounded-xl border border-edge bg-white/[0.035] px-3 py-2 text-left md:w-28 md:border-0 md:bg-transparent md:p-0 md:text-right">
          <div className="num text-sm font-bold tracking-wider text-ink md:text-xs">{formatDisplayFiat(c.price ?? 0, 6)}</div>
          <div className={`num mt-0.5 text-[11px] font-black uppercase tracking-widest ${change >= 0 ? "text-neon" : "text-red"}`}>
            {change >= 0 ? "▲" : "▼"} {fmtPct(change)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:flex md:w-20 md:justify-center md:gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
        <button
          className="btn-primary h-10 px-2 text-[11px] font-black uppercase tracking-widest md:h-auto md:flex-none md:rounded-lg md:py-1.5"
          onClick={(e) => { e.stopPropagation(); onTrade?.("BUY", c); }}
        >BUY</button>
        <button
          className="btn h-10 border-white/[0.04] px-2 text-[11px] font-black uppercase tracking-widest md:h-auto md:flex-none md:rounded-lg md:py-1.5"
          onClick={(e) => { e.stopPropagation(); onTrade?.("SELL", c); }}
        >SELL</button>
      </div>
    </motion.div>
  );
}
