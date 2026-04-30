"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useRef } from "react";
import { Star, Rocket } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { Sparkline } from "./Sparkline";
import { Tooltip, Glossary } from "./Tooltip";
import { fmtNum, fmtPct } from "@/lib/pricing";
import { useWatchlist } from "@/lib/store";
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
}: {
  c: AudiusCoin;
  isOwner?: boolean;
  onTrade?: (side: "BUY" | "SELL", c: AudiusCoin) => void;
}) {
  const router = useRouter();
  const watchlist = useWatchlist();
  const isWatched = watchlist.items.includes(c.mint);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const change = c.priceChange24hPercent ?? 0;
  const spark = c.sparkline ?? [];
  const sparkUp = spark.length >= 2 ? spark[spark.length - 1] >= spark[0] : change >= 0;
  const sparkColor = sparkUp ? "#00E572" : "#FF3366";
  const tier = getTier(c.marketCap ?? 0);

  const trackTitle = c.audius_track_title ?? null;
  const audioUrl = c.audius_track_id ? `https://api.audius.co/v1/tracks/${c.audius_track_id}/stream?app_name=songdaq` : null;

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`panel panel-hover p-5 flex flex-col gap-4 w-full text-left cursor-pointer relative overflow-hidden grain ${tier.glow}`}
      onClick={() => router.push(`/coin/${c.mint}`)}
    >
      {/* Ambient glow */}
      <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-[60px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${sparkUp ? "bg-neon/10" : "bg-red/10"}`} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] shadow-depth shrink-0">
            <SafeImage src={c.logo_uri} alt={c.ticker} fill sizes="48px" className="object-cover" fallback={c.ticker} />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/5 pointer-events-none" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-white tracking-tight truncate">${c.ticker}</span>
              {tier.label && (
                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${tier.color}`}>
                  {tier.label}
                </span>
              )}
              {isOwner && (
                <Tooltip content="This is your launched Artist Coin. As the creator, you cannot trade your own coin.">
                  <span className="chip-violet text-[8px]">Issuer</span>
                </Tooltip>
              )}
            </div>
            <div className="text-[10px] text-white/25 truncate uppercase tracking-widest font-bold mt-0.5">
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
              : "bg-white/[0.02] text-white/15 border border-transparent hover:text-white/40 hover:bg-white/[0.04]"
          }`}
        >
          <Star size={12} fill={isWatched ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Track info */}
      {trackTitle && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-violet animate-pulseDot text-xs">♪</span>
          <span className="text-[10px] text-white/20 truncate uppercase tracking-widest font-bold">{trackTitle}</span>
          {c.audius_play_count ? <span className="shrink-0 text-[10px] text-white/10 font-mono">· {fmtNum(c.audius_play_count)}</span> : null}
        </div>
      )}

      {/* Price + Sparkline row */}
      <div className="flex items-end justify-between gap-4 pt-1">
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-black tracking-tighter text-white uppercase flex items-center gap-2 mb-2">
            <Rocket className="text-neon" size={14} />
            Artist Coin Launch
          </h2>
          <span className="text-[9px] text-white/20 uppercase tracking-widest font-black mb-1">Price</span>
          <span className="num text-xl font-black tracking-tight text-white">{fmtUsd(c.price ?? 0, 6)}</span>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[9px] text-white/15 uppercase tracking-widest font-bold">
              Cap <span className="text-white/35 ml-1">{fmtUsd(c.marketCap ?? 0, 0)}</span>
            </span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/[0.06]" />
            <span className="text-[9px] text-white/15 uppercase tracking-widest font-bold">
              Vol <span className="text-white/35 ml-1">{fmtUsd(c.v24hUSD ?? 0, 0)}</span>
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
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.03] min-h-[40px]">
          <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold">
            {c.holder ?? 0} Holders
          </span>
          {audioUrl ? (
            <button
              onClick={togglePlay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                playing
                  ? "bg-violet/10 border-violet/20 text-violet"
                  : "bg-white/[0.02] border-white/[0.04] text-white/25 hover:text-white/50 hover:bg-white/[0.04]"
              }`}
            >
              {playing ? "⏸ Playing" : "▶ Stream"}
            </button>
          ) : (
            <div className="h-8" /> 
          )}
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

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          preload="none"
          className="hidden"
        />
      )}
    </motion.div>
  );
}

export function CoinListRow({
  c,
  isOwner,
  onTrade,
}: {
  c: AudiusCoin;
  isOwner?: boolean;
  onTrade?: (side: "BUY" | "SELL", c: AudiusCoin) => void;
}) {
  const router = useRouter();
  const watchlist = useWatchlist();
  const change = c.priceChange24hPercent ?? 0;
  const tier = getTier(c.marketCap ?? 0);

  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={() => router.push(`/coin/${c.mint}`)}
      className="panel p-3 flex items-center gap-4 cursor-pointer hover:bg-white/[0.03] transition-all duration-300 group"
    >
      {/* Watchlist */}
      <button
        onClick={(e) => { e.stopPropagation(); watchlist.toggle(c.mint); }}
        className={`w-6 h-6 flex items-center justify-center rounded-md shrink-0 transition-all ${
          watchlist.items.includes(c.mint) ? "text-gold" : "text-white/10 hover:text-white/30"
        }`}
      >
        <Star size={10} fill={watchlist.items.includes(c.mint) ? "currentColor" : "none"} />
      </button>
      
      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/[0.04] shrink-0">
        <SafeImage src={c.logo_uri} alt={c.ticker} fill sizes="36px" className="object-cover" fallback={c.ticker} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tight group-hover:text-neon transition">${c.ticker}</span>
          {tier.label && <span className={`text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded border ${tier.color}`}>{tier.label}</span>}
          <span className="text-[9px] text-white/15 uppercase tracking-widest font-bold">{c.holder ?? 0} holders</span>
        </div>
        <div className="text-[10px] text-white/20 truncate uppercase tracking-widest mt-0.5">{c.artist_name || c.name}</div>
      </div>
      <div className="w-28 text-right">
        <div className="num text-xs font-bold text-white tracking-wider">{fmtUsd(c.marketCap ?? 0, 0)}</div>
        <div className="text-[9px] text-white/15 uppercase tracking-widest mt-0.5">Market Cap</div>
      </div>
      <div className="w-28 text-right">
        <div className="num text-xs font-bold text-white tracking-wider">{fmtUsd(c.price ?? 0, 6)}</div>
        <div className={`num text-[10px] font-black uppercase tracking-widest mt-0.5 ${change >= 0 ? "text-neon" : "text-red"}`}>
          {change >= 0 ? "▲" : "▼"} {fmtPct(change)}
        </div>
      </div>
      <div className="w-20 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="btn-primary px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest"
          onClick={(e) => { e.stopPropagation(); onTrade?.("BUY", c); }}
        >BUY</button>
        <button
          className="btn px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border-white/[0.04]"
          onClick={(e) => { e.stopPropagation(); onTrade?.("SELL", c); }}
        >SELL</button>
      </div>
    </motion.div>
  );
}
