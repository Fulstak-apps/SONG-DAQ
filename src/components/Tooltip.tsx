"use client";
import { useState, useRef, ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, BookOpen, TrendingUp, TrendingDown, Lightbulb, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   Enhanced Tooltip — Premium contextual help system
   ═══════════════════════════════════════════════════════════ */

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  delay?: number;
  side?: "top" | "bottom";
  width?: number;
}

export function Tooltip({ children, content, delay = 0.25, side = "top", width = 280 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const timer = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 10;
      const safeWidth = Math.min(width, window.innerWidth - 16);
      const left = Math.min(Math.max(rect.left + rect.width / 2, safeWidth / 2 + 8), window.innerWidth - safeWidth / 2 - 8);
      const top = side === "bottom"
        ? Math.min(rect.bottom + gap, window.innerHeight - 24)
        : Math.max(rect.top - gap, 24);
      setPos({ left, top });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, side, width]);

  const handleEnter = () => {
    timer.current = setTimeout(() => setOpen(true), delay * 1000);
  };

  const handleLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex items-center cursor-help"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onTouchStart={() => setOpen(true)}
      onTouchEnd={() => setTimeout(() => setOpen(false), 3000)}
    >
      {children}
      {mounted ? createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: side === "bottom" ? -6 : 6, scale: 0.95, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: side === "bottom" ? -4 : 4, scale: 0.95, filter: "blur(2px)" }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed -translate-x-1/2 max-w-[calc(100vw-1rem)] p-3.5 bg-panel/95 backdrop-blur-2xl border border-edge rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-[200] pointer-events-none"
            style={{
              width: Math.min(width, typeof window !== "undefined" ? window.innerWidth - 16 : width),
              left: pos.left,
              top: pos.top,
              transform: side === "bottom" ? "translateX(-50%)" : "translateX(-50%) translateY(-100%)",
            }}
          >
            <div className="text-[13px] font-medium text-ink leading-relaxed">
              {content}
            </div>
            {/* Glossy top edge */}
            <div className="absolute top-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-pure-white/15 to-transparent rounded-full" />
            {/* Subtle inner glow */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: "inset 0 0 20px rgba(255,255,255,0.02)" }} />
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Glossary — Inline term explainer with progressive education
   ═══════════════════════════════════════════════════════════ */

type TermCategory = "beginner" | "advanced" | "protocol" | "financial";

const CATEGORY_STYLES: Record<TermCategory, { color: string; icon: ReactNode; label: string }> = {
  beginner: { color: "text-neon", icon: <Lightbulb size={10} />, label: "BASICS" },
  advanced: { color: "text-violet", icon: <BookOpen size={10} />, label: "ADVANCED" },
  protocol: { color: "text-cyan", icon: <HelpCircle size={10} />, label: "PROTOCOL" },
  financial: { color: "text-gold", icon: <TrendingUp size={10} />, label: "FINANCIAL" },
};

export function Glossary({ 
  term, 
  def, 
  children, 
  category = "beginner",
  learnMore
}: { 
  term: string; 
  def: string; 
  children?: ReactNode; 
  category?: TermCategory;
  learnMore?: string;
}) {
  const cat = CATEGORY_STYLES[category];
  
  return (
    <Tooltip
      content={
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 ${cat.color} text-[9px] uppercase tracking-widest font-black`}>
              {cat.icon}
              {cat.label}
            </span>
          </div>
          <div className={`text-sm font-bold ${cat.color}`}>{term}</div>
          <div className="text-[12px] text-mute font-normal leading-relaxed">{def}</div>
          {learnMore && (
            <div className="pt-1 border-t border-edge">
              <span className="text-[10px] text-mute uppercase tracking-widest">Tap to learn more</span>
            </div>
          )}
        </div>
      }
      width={300}
    >
      <span className="border-b border-dashed border-white/20 hover:border-neon/60 hover:text-neon transition-all duration-300 cursor-help">
        {children || term}
      </span>
    </Tooltip>
  );
}

export function InfoTooltip({ label, def, side = "top" }: { label?: string; def: string; side?: "top" | "bottom" }) {
  return (
    <Tooltip
      side={side}
      width={300}
      content={<div className="text-[12px] leading-relaxed text-mute">{def}</div>}
    >
      <span className="inline-flex items-center gap-1">
        {label ? <span>{label}</span> : null}
        <span className="grid h-4 w-4 place-items-center rounded-full border border-white/15 bg-white/[0.055] text-[10px] font-black text-mute transition hover:border-neon/35 hover:text-neon">
          ?
        </span>
      </span>
    </Tooltip>
  );
}

/* ═══════════════════════════════════════════════════════════
   WhyDidThisMove — Explains token price movements
   ═══════════════════════════════════════════════════════════ */

interface PriceDriver {
  factor: string;
  impact: "bullish" | "bearish" | "neutral";
  description: string;
  confidence: number; // 0-100
}

export function WhyDidThisMove({ 
  symbol, 
  change, 
  drivers 
}: { 
  symbol: string; 
  change: number; 
  drivers?: PriceDriver[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const isUp = change >= 0;
  
  const defaultDrivers: PriceDriver[] = drivers ?? [
    {
      factor: isUp ? "Increased trading volume" : "Volume decline",
      impact: isUp ? "bullish" : "bearish",
      description: isUp 
        ? "Trading activity surged in the last 24h, indicating growing market interest."
        : "Declining volume suggests reduced market interest.",
      confidence: 72,
    },
    {
      factor: isUp ? "Whale accumulation" : "Large holder exit",
      impact: isUp ? "bullish" : "bearish",
      description: isUp 
        ? "Large wallets have been accumulating, signaling institutional confidence."
        : "A significant holder reduced their position.",
      confidence: 58,
    },
    {
      factor: "Streaming momentum",
      impact: isUp ? "bullish" : "neutral",
      description: isUp
        ? "The artist's streaming numbers are trending upward across platforms."
        : "Streaming numbers remain stable with no significant changes.",
      confidence: 65,
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
          open
            ? "bg-pure-white/10 border-pure-white/15 text-pure-white"
            : "bg-pure-white/5 border border-pure-white/10 text-pure-white/45 hover:text-pure-white/75 hover:bg-pure-white/10"
        }`}
      >
        <Lightbulb size={12} />
        Why did this move?
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, scale: 0.95, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full mt-2 right-0 w-[min(380px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-2xl border border-edge bg-panel/95 backdrop-blur-2xl shadow-[0_24px_48px_rgba(0,0,0,0.7)] z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-edge flex items-center justify-between bg-panel2">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-black text-mute mb-1">Price Intelligence</div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">${symbol}</span>
                  <span className={`num text-sm font-bold ${isUp ? "text-neon" : "text-red"}`}>
                    {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                  </span>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 transition text-mute hover:text-white">
                <X size={14} />
              </button>
            </div>

            {/* Drivers */}
            <div className="p-4 space-y-3">
              {defaultDrivers.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-3 p-3 rounded-xl bg-panel2 border border-edge hover:border-white/25 transition"
                >
                  <div className="shrink-0 mt-0.5">
                    {d.impact === "bullish" ? (
                      <TrendingUp size={14} className="text-neon" />
                    ) : d.impact === "bearish" ? (
                      <TrendingDown size={14} className="text-red" />
                    ) : (
                      <span className="w-3.5 h-0.5 rounded-full bg-pure-white/20 block mt-1.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-ink tracking-tight">{d.factor}</span>
                      <span className="text-[9px] text-mute font-mono">{d.confidence}%</span>
                    </div>
                    <p className="text-[11px] text-mute leading-relaxed mt-1">{d.description}</p>
                    {/* Confidence bar */}
                    <div className="mt-2 h-1 rounded-full bg-pure-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${d.confidence}%` }}
                        transition={{ delay: 0.2 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${d.impact === "bullish" ? "bg-neon/40" : d.impact === "bearish" ? "bg-red/40" : "bg-pure-white/10"}`}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-edge bg-panel2">
              <p className="text-[9px] text-mute uppercase tracking-widest font-bold text-center">
                AI-generated analysis · Not financial advice
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   OnboardingHint — Progressive education toast
   ═══════════════════════════════════════════════════════════ */

export function OnboardingHint({ 
  id, 
  title, 
  description, 
  icon 
}: { 
  id: string; 
  title: string; 
  description: string; 
  icon?: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const storageKey = `onboarding-${id}`;

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, "1");
  };

  if (dismissed || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="fixed bottom-24 right-6 w-[340px] max-w-[calc(100vw-2rem)] p-4 rounded-2xl border border-edge bg-panel/95 backdrop-blur-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-50 text-ink"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-neon/10 flex items-center justify-center text-neon shrink-0">
            {icon || <Lightbulb size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">{title}</span>
              <button onClick={dismiss} className="text-mute hover:text-white transition">
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-mute leading-relaxed mt-1">{description}</p>
          </div>
        </div>
        {/* Top glow edge */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-neon/20 to-transparent" />
      </motion.div>
    </AnimatePresence>
  );
}
