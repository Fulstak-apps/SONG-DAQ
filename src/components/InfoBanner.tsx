"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, Activity, TrendingUp, Lock, Sparkles } from "lucide-react";

const MESSAGES = [
  {
    id: "insurance",
    icon: <Shield size={14} className="text-neon" />,
    label: "On-Chain Assets",
    text: "Song Coin launches create a real Solana SPL mint and mint supply to the artist wallet.",
    accent: "neon",
  },
  {
    id: "royalties",
    icon: <Zap size={14} className="text-violet" />,
    label: "Royalty Splits",
    text: "Royalty split settings are captured at launch and marked pending until contracts are locked.",
    accent: "violet",
  },
  {
    id: "security",
    icon: <Activity size={14} className="text-cyan" />,
    label: "Audit Protocol",
    text: "Real-time auditing of distributor accounts ensures royalty data integrity.",
    accent: "cyan",
  },
  {
    id: "whale",
    icon: <TrendingUp size={14} className="text-gold" />,
    label: "Whale Detection",
    text: "Large position changes are flagged in real-time across all assets.",
    accent: "gold",
  },
  {
    id: "prestige",
    icon: <Sparkles size={14} className="text-violet" />,
    label: "Prestige System",
    text: "Trade, hold, and engage to earn XP. Unlock exclusive tiers and features.",
    accent: "violet",
  },
];

export function InfoBanner() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const i = setInterval(() => {
      setIdx((v) => (v + 1) % MESSAGES.length);
    }, 4000);
    return () => clearInterval(i);
  }, [paused]);

  const m = MESSAGES[idx];

  return (
    <div
      className="flex min-h-10 items-center overflow-hidden rounded-xl border border-edge bg-panel px-3 py-2 backdrop-blur-xl sm:h-10 sm:px-5 sm:py-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.01] to-transparent pointer-events-none" />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex w-full items-center gap-3"
        >
          <div className="shrink-0">{m.icon}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-mute whitespace-nowrap">{m.label}</span>
            <span className="hidden h-1 w-1 shrink-0 rounded-full bg-edge sm:block" />
            <span className="truncate text-[11px] font-medium text-ink">{m.text}</span>
          </div>
          {/* Progress dots */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {MESSAGES.map((_, i) => (
              <div
                key={i}
                className={`w-1 h-1 rounded-full transition-all duration-300 ${
                  i === idx ? "bg-neon/80 w-3" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
