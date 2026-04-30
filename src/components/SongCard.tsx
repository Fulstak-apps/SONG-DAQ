"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useRef } from "react";
import { Star } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { Tooltip } from "./Tooltip";
import { fmtSol, fmtNum, fmtPct } from "@/lib/pricing";
import { useWatchlist } from "@/lib/store";

export interface SongRow {
  id: string;
  symbol: string;
  title: string;
  artistName: string;
  artworkUrl?: string | null;
  price: number;
  performance: number;
  marketCap: number;
  volume24h: number;
  streams: number;
  circulating: number;
  supply: number;
  streamUrl?: string | null;
  coverUrl?: string | null;
  splitsLocked?: boolean;
}

export function SongCard({ s, compact = false }: { s: SongRow; compact?: boolean }) {
  const router = useRouter();
  const watchlist = useWatchlist();
  const isWatched = watchlist.items.includes(s.id);
  const change = (s.performance - 1) * 100;
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  if (compact) {
    return (
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="panel panel-hover p-4 flex flex-col gap-3 relative overflow-hidden cursor-pointer grain"
        onClick={() => router.push(`/song/${s.id}`)}
      >
        <div className="absolute top-3 right-3 z-10">
          {s.splitsLocked ? (
            <Tooltip content="Splits Locked: Artist royalties are cryptographically routing to token holders.">
              <span className="w-2 h-2 rounded-full bg-neon block shadow-[0_0_6px_rgba(0,229,114,0.5)]" />
            </Tooltip>
          ) : (
            <Tooltip content="Unverified: Royalties are not yet verified on-chain.">
              <span className="w-2 h-2 rounded-full bg-amber block shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/[0.06] shadow-lg relative">
            {s.coverUrl ? (
              <SafeImage src={s.coverUrl} alt={s.title} width={44} height={44} className="object-cover" />
            ) : (
              <div className="w-full h-full bg-white/[0.02]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 mix-blend-overlay pointer-events-none" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm truncate tracking-tight text-white">{s.title}</div>
            <div className="text-[10px] text-white/20 truncate uppercase tracking-widest mt-0.5">{s.artistName}</div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.03]">
          <span className="num text-xs font-bold text-white">{fmtSol(s.price, 4)}</span>
          <span className={`num text-[10px] font-black tracking-wider ${change >= 0 ? "text-neon" : "text-red"}`}>{fmtPct(change)}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="panel panel-hover p-5 flex flex-col gap-4 cursor-pointer relative overflow-hidden grain"
      onClick={() => router.push(`/song/${s.id}`)}
    >
      {/* Ambient glow */}
      <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-[60px] pointer-events-none transition-opacity duration-700 ${change >= 0 ? "bg-neon/5" : "bg-red/5"}`} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] shadow-depth shrink-0">
            <SafeImage src={s.artworkUrl} alt={s.title} fill sizes="56px" className="object-cover" fallback={s.symbol} />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/5 pointer-events-none" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-white tracking-tight truncate">{s.title}</span>
              <span className="text-[8px] font-mono font-black uppercase tracking-widest text-white/15 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">{s.symbol}</span>
            </div>
            <div className="text-[10px] text-white/20 truncate uppercase tracking-widest font-bold mt-0.5">{s.artistName}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Verification badge */}
          {s.splitsLocked ? (
            <Tooltip content="Verified: Distributor-confirmed royalty splits locked on-chain.">
              <span className="chip-neon text-[8px] py-0.5">✓ Verified</span>
            </Tooltip>
          ) : (
            <Tooltip content="Pending: Artist has not yet locked distributor splits.">
              <span className="chip text-amber border-amber/20 bg-amber/5 text-[8px] py-0.5">Pending</span>
            </Tooltip>
          )}
          {/* Watchlist */}
          <button
            onClick={(e) => { e.stopPropagation(); watchlist.toggle(s.id); }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
              isWatched ? "bg-gold/10 text-gold border border-gold/20" : "text-white/10 hover:text-white/30"
            }`}
          >
            <Star size={12} fill={isWatched ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {/* Price stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <span className="text-[9px] text-white/15 uppercase tracking-widest font-black mb-1">Price</span>
          <span className="num text-lg font-black text-white">{fmtSol(s.price, 5)} <span className="text-[9px] text-white/20">SOL</span></span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-white/15 uppercase tracking-widest font-black mb-1">24h</span>
          <span className={`num text-lg font-black ${change >= 0 ? "text-neon" : "text-red"}`}>{change >= 0 ? "+" : ""}{fmtPct(change)}</span>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="flex items-center gap-4 text-[9px] text-white/15 uppercase tracking-widest font-bold">
        <span>Streams <span className="text-white/30 ml-1">{fmtNum(s.streams)}</span></span>
        <span className="w-0.5 h-0.5 rounded-full bg-white/[0.06]" />
        <span>Vol <span className="text-white/30 ml-1">{fmtSol(s.volume24h, 2)}</span></span>
      </div>

      {/* Float progress bar */}
      <div className="flex items-center gap-3 pt-2 border-t border-white/[0.03]">
        <div className="flex-1 h-1 rounded-full bg-white/[0.03] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (s.circulating / s.supply) * 100)}%` }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="h-full bg-gradient-to-r from-neon/30 to-neon/60 rounded-full"
          />
        </div>
        <span className="text-[9px] text-white/20 uppercase tracking-widest font-black whitespace-nowrap">
          {(s.circulating / s.supply * 100).toFixed(0)}% float
        </span>
      </div>

      {/* Stream button */}
      {s.streamUrl && (
        <>
          <button
            onClick={togglePlay}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
              playing
                ? "bg-neon/8 border-neon/20 text-neon"
                : "bg-white/[0.02] border-white/[0.04] text-white/25 hover:text-white/50 hover:bg-white/[0.04]"
            }`}
          >
            {playing ? "⏸ Playing" : "▶ Stream"}
          </button>
          <audio
            ref={audioRef}
            src={s.streamUrl}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            preload="none"
            className="hidden"
          />
        </>
      )}
    </motion.div>
  );
}

export function SongListRow({ s }: { s: SongRow }) {
  const router = useRouter();
  const watchlist = useWatchlist();
  const change = (s.performance - 1) * 100;

  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={() => router.push(`/song/${s.id}`)}
      className="panel p-3 flex items-center gap-4 cursor-pointer hover:bg-white/[0.03] transition-all duration-300 group"
    >
      <button
        onClick={(e) => { e.stopPropagation(); watchlist.toggle(s.id); }}
        className={`w-6 h-6 flex items-center justify-center rounded-md shrink-0 transition-all ${
          watchlist.items.includes(s.id) ? "text-gold" : "text-white/10 hover:text-white/30"
        }`}
      >
        <Star size={10} fill={watchlist.items.includes(s.id) ? "currentColor" : "none"} />
      </button>
      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/[0.04] shrink-0">
        <SafeImage src={s.artworkUrl || s.coverUrl} alt={s.title} fill sizes="36px" className="object-cover" fallback={s.symbol} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tight group-hover:text-neon transition">{s.title}</span>
          <span className="text-[9px] text-white/15 uppercase tracking-widest font-black">{s.symbol}</span>
        </div>
        <div className="text-[10px] text-white/20 truncate uppercase tracking-widest mt-0.5">{s.artistName}</div>
      </div>
      <div className="w-28 text-right">
        <div className="num text-xs font-bold text-white tracking-wider">{fmtSol(s.marketCap, 2)} SOL</div>
        <div className="text-[9px] text-white/15 uppercase tracking-widest mt-0.5">Valuation</div>
      </div>
      <div className="w-28 text-right">
        <div className="num text-xs font-bold text-white tracking-wider">{fmtSol(s.price, 6)} SOL</div>
        <div className={`num text-[10px] font-black uppercase tracking-widest mt-0.5 ${change >= 0 ? "text-neon" : "text-red"}`}>
          {change >= 0 ? "▲" : "▼"} {fmtPct(change)}
        </div>
      </div>
      <div className="w-24 flex flex-col items-center gap-1">
        {s.splitsLocked ? (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neon/5 border border-neon/10 text-[8px] font-black uppercase tracking-widest text-neon">
            <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_4px_rgba(0,229,114,0.5)]" /> ON-CHAIN
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber/5 border border-amber/10 text-[8px] font-black uppercase tracking-widest text-amber">
            <span className="w-1.5 h-1.5 rounded-full bg-amber shadow-[0_0_4px_rgba(245,158,11,0.5)]" /> PENDING
          </div>
        )}
      </div>
    </motion.div>
  );
}
