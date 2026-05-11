"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { Star, Rocket, Play, Pause } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { Sparkline } from "./Sparkline";
import { Tooltip, Glossary } from "./Tooltip";
import { fmtNum, fmtPct } from "@/lib/pricing";
import { usePlayer, useWatchlist, type PlayerTrack } from "@/lib/store";
import { toast } from "@/lib/toast";
import { RiskBadge } from "./RiskBadge";
import type { AudiusCoin } from "@/lib/audiusCoins";

function fmtUsd(n: number, digits = 4) {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(digits)}`;
}

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
  const isWatched = watchlist.items.includes(c.mint);

  const change = c.priceChange24hPercent ?? 0;
  const spark = c.sparkline ?? [];
  const sparkUp = spark.length >= 2 ? spark[spark.length - 1] >= spark[0] : change >= 0;
  const sparkColor = sparkUp ? "#00E572" : "#FF3366";
  const tier = getTier(c.marketCap ?? 0);

  const trackTitle = c.audius_track_title ?? null;
  const audioUrl = c.audius_track_id ? `https://api.audius.co/v1/tracks/${c.audius_track_id}/stream?app_name=songdaq` : null;
  const playerTrack = useMemo<PlayerTrack | null>(() => audioUrl && c.audius_track_id ? ({
    id: String(c.audius_track_id),
    title: c.audius_track_title ?? c.name,
    artist: c.artist_name ?? c.name,
    artwork: c.audius_track_artwork ?? c.logo_uri ?? null,
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
      className={`panel panel-hover p-5 flex flex-col gap-4 w-full h-[360px] text-left cursor-pointer relative overflow-hidden grain ${tier.glow}`}
      onClick={() => onOpen ? onOpen(c) : router.push(`/coin/${c.mint}`)}
    >
      {/* Ambient glow */}
      <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-[60px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${sparkUp ? "bg-neon/10" : "bg-red/10"}`} />
      <div className="absolute inset-x-0 bottom-16 h-12 wave-line opacity-20" />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-edge bg-panel2 shadow-depth shrink-0">
            <SafeImage src={c.logo_uri} alt={c.ticker} fill sizes="48px" className="object-cover" fallback={c.ticker} />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/5 pointer-events-none" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-ink tracking-tight truncate">${c.ticker}</span>
              {tier.label && (
                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${tier.color}`}>
                  {tier.label}
                </span>
              )}
              {isOwner && (
                <Tooltip content="This is your launched Artist Token. As the creator, you cannot trade your own coin.">
                  <span className="chip-violet text-[8px]">Issuer</span>
                </Tooltip>
              )}
              <RiskBadge coin={c as any} compact />
            </div>
            <div className="text-[10px] text-mute truncate uppercase tracking-widest font-bold mt-0.5">
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

      {/* Track info: fixed height so Artist Tokens and song tokens align. */}
      <div className="flex h-5 items-center gap-2 px-1">
        {trackTitle ? (
          <>
          <span className="text-violet animate-pulseDot text-xs">♪</span>
          <span className="text-[10px] text-mute truncate uppercase tracking-widest font-bold">{trackTitle}</span>
          {c.audius_play_count ? <span className="shrink-0 text-[10px] text-mute font-mono">· {fmtNum(c.audius_play_count)}</span> : null}
          </>
        ) : (
          <>
            <span className="text-neon text-xs">◌</span>
            <span className="text-[10px] text-mute truncate uppercase tracking-widest font-bold">Audio preview unavailable</span>
          </>
        )}
      </div>

      {/* Price + Sparkline row */}
      <div className="flex flex-1 items-end justify-between gap-4 pt-1">
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-black tracking-tighter text-ink uppercase flex items-center gap-2 mb-2">
            <Rocket className="text-neon" size={14} />
            Artist Token
          </h2>
          <span className="text-[9px] text-mute uppercase tracking-widest font-black mb-1">Price</span>
          <span className="num text-xl font-black tracking-tight text-ink">{fmtUsd(c.price ?? 0, 6)}</span>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[9px] text-mute uppercase tracking-widest font-bold">
              Cap <span className="text-ink ml-1">{fmtUsd(c.marketCap ?? 0, 0)}</span>
            </span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/[0.06]" />
            <span className="text-[9px] text-mute uppercase tracking-widest font-bold">
              Vol <span className="text-ink ml-1">{fmtUsd(c.v24hUSD ?? 0, 0)}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="w-24 h-10 opacity-50 group-hover:opacity-100 transition-opacity">
            <Sparkline data={spark.length ? spark : [0, 0]} color={sparkColor} />
          </div>
          <span className={`num text-[10px] px-2.5 py-1 rounded-lg font-black tracking-wider ${
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
          <span className="text-[9px] text-mute uppercase tracking-widest font-bold">
            {c.holder ?? 0} Holders
          </span>
          <button
            onClick={togglePlay}
            className={`flex h-10 min-w-[92px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
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
          className="btn-primary flex-1 h-10 text-[10px] font-black uppercase tracking-widest"
          onClick={(e) => { e.stopPropagation(); onTrade?.("BUY", c); }}
        >Buy</button>
        <button
          disabled={isOwner}
          className={`btn h-10 px-5 text-[10px] font-black uppercase tracking-widest ${isOwner ? "opacity-20 cursor-not-allowed" : "hover:bg-red/8 hover:text-red hover:border-red/20"}`}
          onClick={(e) => { e.stopPropagation(); if (!isOwner) onTrade?.("SELL", c); }}
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
  const change = c.priceChange24hPercent ?? 0;
  const tier = getTier(c.marketCap ?? 0);

  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={() => onOpen ? onOpen(c) : router.push(`/coin/${c.mint}`)}
      className="panel p-3 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 cursor-pointer hover:bg-white/[0.07] transition-all duration-300 group"
    >
      {/* Watchlist */}
      <button
        onClick={(e) => { e.stopPropagation(); watchlist.toggle(c.mint); }}
        className={`w-6 h-6 flex items-center justify-center rounded-md shrink-0 transition-all ${
          watchlist.items.includes(c.mint) ? "text-gold" : "text-mute hover:text-ink"
        }`}
      >
        <Star size={10} fill={watchlist.items.includes(c.mint) ? "currentColor" : "none"} />
      </button>
      
      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-edge shrink-0 bg-panel2">
        <SafeImage src={c.logo_uri} alt={c.ticker} fill sizes="36px" className="object-cover" fallback={c.ticker} />
      </div>
      <div className="min-w-[160px] flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tight group-hover:text-neon transition">${c.ticker}</span>
          <RiskBadge coin={c as any} compact />
          {tier.label && <span className={`text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded border ${tier.color}`}>{tier.label}</span>}
          <span className="text-[9px] text-mute uppercase tracking-widest font-bold">{c.holder ?? 0} holders</span>
        </div>
        <div className="text-[10px] text-mute truncate uppercase tracking-widest mt-0.5">{c.artist_name || c.name}</div>
      </div>
      <div className="w-[calc(50%-0.375rem)] sm:w-28 text-left sm:text-right rounded-xl sm:rounded-none border border-edge sm:border-0 bg-white/[0.035] sm:bg-transparent px-3 py-2 sm:p-0">
        <div className="num text-xs font-bold text-ink tracking-wider">{fmtUsd(c.marketCap ?? 0, 0)}</div>
        <div className="text-[9px] text-mute uppercase tracking-widest mt-0.5">Market Cap</div>
      </div>
      <div className="w-[calc(50%-0.375rem)] sm:w-28 text-left sm:text-right rounded-xl sm:rounded-none border border-edge sm:border-0 bg-white/[0.035] sm:bg-transparent px-3 py-2 sm:p-0">
        <div className="num text-xs font-bold text-ink tracking-wider">{fmtUsd(c.price ?? 0, 6)}</div>
        <div className={`num text-[10px] font-black uppercase tracking-widest mt-0.5 ${change >= 0 ? "text-neon" : "text-red"}`}>
          {change >= 0 ? "▲" : "▼"} {fmtPct(change)}
        </div>
      </div>
      <div className="w-full sm:w-20 flex justify-stretch sm:justify-center gap-2 sm:gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          className="btn-primary flex-1 sm:flex-none px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest"
          onClick={(e) => { e.stopPropagation(); onTrade?.("BUY", c); }}
        >BUY</button>
        <button
          className="btn flex-1 sm:flex-none px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border-white/[0.04]"
          onClick={(e) => { e.stopPropagation(); onTrade?.("SELL", c); }}
        >SELL</button>
      </div>
    </motion.div>
  );
}
