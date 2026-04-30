"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fmtSol, fmtNum } from "@/lib/pricing";
import { Glossary } from "./Tooltip";

interface Event {
  id: string;
  kind: string;
  payload: any;
  createdAt: string;
  song: { symbol: string; title: string; artworkUrl: string | null };
}

type Filter = "LIVE" | "TODAY" | "WEEK" | "MONTH";

export function TradeFeed({ songId }: { songId?: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<Filter>("LIVE");
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/feed", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        const list = (j.events || []) as Event[];
        
        let filtered = list;
        if (songId) {
          filtered = list.filter((e) => e.payload?.symbol === songId || (e as any).songId === songId);
        }

        const now = Date.now();
        if (filter === "TODAY") {
          filtered = filtered.filter(e => now - new Date(e.createdAt).getTime() < 86400000);
        } else if (filter === "WEEK") {
          filtered = filtered.filter(e => now - new Date(e.createdAt).getTime() < 86400000 * 7);
        } else if (filter === "MONTH") {
          filtered = filtered.filter(e => now - new Date(e.createdAt).getTime() < 86400000 * 30);
        }

        setEvents(filtered);
      } catch { /* ignore */ }
      finally { if (alive) setLoaded(true); }
    }
    load();
    const i = setInterval(load, 6_000);
    return () => { alive = false; clearInterval(i); };
  }, [songId, filter]);

  // Auto-scroll logic for LIVE only
  useEffect(() => {
    if (filter !== "LIVE") return;
    const el = scrollRef.current;
    if (!el || events.length === 0) return;
    
    let animationId: number;
    let scrollPos = el.scrollTop;
    
    const step = () => {
      if (el.matches(":hover") || el.matches(":active") || el.matches(":focus-within")) {
        scrollPos = el.scrollTop;
        animationId = requestAnimationFrame(step);
        return;
      }
      
      scrollPos += 0.3;
      if (scrollPos >= el.scrollHeight - el.clientHeight) {
        scrollPos = 0;
      }
      
      el.scrollTop = scrollPos;
      animationId = requestAnimationFrame(step);
    };
    
    animationId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationId);
  }, [events, loaded, filter]);

  return (
    <div className="panel-elevated relative overflow-hidden flex flex-col h-[400px] grain">
      {/* Ambient glow */}
      <div className="absolute -top-16 -right-16 w-40 h-40 bg-neon/5 rounded-full blur-[60px] pointer-events-none" />
      
      <div className="px-5 py-3.5 flex items-center justify-between relative z-10 shrink-0 border-b border-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="w-2 h-2 rounded-full bg-neon block shadow-[0_0_6px_rgba(0,229,114,0.5)] animate-pulseDot" />
          </div>
          <span className="label text-xs">
            <Glossary term="Live Feed" def="Real-time stream of all buys, sells, and token launches across the network." category="beginner">
              Network Velocity
            </Glossary>
          </span>
        </div>
        <div className="flex items-center bg-white/[0.02] border border-white/[0.04] rounded-lg p-0.5 text-[9px] font-black uppercase tracking-widest">
          {(["LIVE", "TODAY", "WEEK", "MONTH"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md transition-all ${filter === f ? "bg-white/[0.06] text-white" : "text-white/20 hover:text-white/40"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {!loaded ? (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="text-xs text-white/20 uppercase tracking-widest animate-pulse font-bold">Syncing market data…</div>
        </div>
      ) : !events.length ? (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="text-sm text-white/40 mb-1 font-bold">No market activity</div>
          <div className="text-[11px] text-white/15">Trades will appear here in real-time.</div>
        </div>
      ) : (
        <ul ref={scrollRef} className="flex-1 overflow-y-auto divide-y divide-white/[0.02] scroll-smooth relative z-10 no-scrollbar">
          <AnimatePresence initial={false}>
            {events.map((e, i) => {
              const c = colorFor(e.kind);
              const p = e.payload || {};
              const isWhale = (e.kind === "BUY" || e.kind === "SELL") && ((p.tokens || 0) * (p.price || 0) > 50 || p.tokens > 500);

              return (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.01, ease: "easeOut" }}
                  className={`px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-all relative ${isWhale ? "bg-gold/[0.02]" : ""}`}
                >
                  {/* Whale highlight line */}
                  {isWhale && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold/40" />}
                  
                  <div className="w-14 shrink-0">
                    <span className={`chip w-full justify-center text-[8px] ${c}`}>{e.kind}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/20 px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/[0.04] font-mono uppercase tracking-widest">{e.song?.symbol || p.symbol || "SYS"}</span>
                      {isWhale && (
                        <span className="text-[8px] bg-gold/10 text-gold border border-gold/20 px-1.5 py-0.5 rounded uppercase tracking-widest font-black animate-pulse">🐋 Whale</span>
                      )}
                    </div>
                    <div className="truncate text-white/60 text-sm mt-1 font-medium tracking-tight">
                      {summary(e)}
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-white/15 num shrink-0 uppercase tracking-widest font-bold">{relTime(e.createdAt)}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function summary(e: Event): string {
  const p = e.payload || {};
  switch (e.kind) {
    case "BUY":
    case "SELL":
      return `${fmtNum(p.tokens ?? 0)} @ ${fmtSol(p.price ?? 0, 6)} SOL`;
    case "LAUNCH":
      return `New Launch · ${p.mint?.slice(0, 8) ?? "—"}…`;
    case "ROYALTY":
      return `Payout +${fmtSol(p.amountSol ?? 0, 4)} SOL`;
    default:
      return "";
  }
}

function colorFor(k: string): string {
  if (k === "BUY") return "text-neon border-neon/20 bg-neon/5";
  if (k === "SELL") return "text-red border-red/20 bg-red/5";
  if (k === "LAUNCH") return "text-cyan border-cyan/20 bg-cyan/5";
  if (k === "ROYALTY") return "text-violet border-violet/20 bg-violet/5";
  return "text-white/20 border-white/[0.04] bg-white/[0.02]";
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
