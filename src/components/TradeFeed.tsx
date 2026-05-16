"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { fmtSol, fmtNum } from "@/lib/pricing";
import { Glossary } from "./Tooltip";
import { SafeImage } from "./SafeImage";
import { useCoins } from "@/lib/useCoins";
import { paperTradeEvents } from "@/lib/paperMarket";
import { usePaperTrading } from "@/lib/store";
import { readJson } from "@/lib/safeJson";

interface Event {
  id: string;
  kind: string;
  payload: any;
  createdAt: string;
  song: { symbol: string; title: string; artworkUrl: string | null };
}

type Filter = "LIVE" | "TODAY" | "WEEK" | "MONTH";

export function TradeFeed({ songId, assetMint, detailMode = false }: { songId?: string; assetMint?: string; detailMode?: boolean }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<Filter>("LIVE");
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const paperMode = usePaperTrading((s) => s.enabled);
  const { coins } = useCoins("volume");
  const [paperTick, setPaperTick] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/feed", { cache: "no-store" });
        const j = await readJson<any>(r);
        if (!alive) return;
        const list = (j?.events || []) as Event[];
        
        let filtered = list;
        if (songId) {
          filtered = list.filter((e) => e.payload?.symbol === songId || (e as any).songId === songId);
        }
        if (assetMint) {
          filtered = filtered.filter((e) => (e.payload?.mint && e.payload.mint === assetMint) || (e.payload?.symbol && e.payload.symbol === assetMint));
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
  }, [songId, assetMint, filter]);

  useEffect(() => {
    if (!paperMode) return;
    setLoaded(true);
    const i = setInterval(() => setPaperTick(Date.now()), 1400);
    return () => clearInterval(i);
  }, [paperMode]);

  // Auto-scroll logic for LIVE only
  useEffect(() => {
    if (filter !== "LIVE" || paused) return;
    const el = scrollRef.current;
    if (!el || (paperMode ? coins.length === 0 : events.length === 0)) return;
    
    let animationId: number;
    const start = performance.now();
    const initial = el.scrollTop;

    const step = () => {
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      const elapsed = performance.now() - start;
      el.scrollTop = (initial + elapsed * 0.02) % maxScroll;
      animationId = requestAnimationFrame(step);
    };
    
    animationId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationId);
  }, [events, loaded, filter, paused, paperMode, coins.length, paperTick]);

  const baseEvents = paperMode && filter === "LIVE"
    ? paperTradeEvents(
      assetMint ? coins.filter((c) => c.mint === assetMint || c.ticker === assetMint).slice(0, 1) : coins,
      paperTick,
      detailMode ? 10 : 20,
    ) as Event[]
    : events;

  const feedEvents = !detailMode && filter === "LIVE" && baseEvents.length > 0 && baseEvents.length < 12
    ? Array.from({ length: Math.ceil(12 / baseEvents.length) }).flatMap(() => baseEvents)
    : baseEvents;

  return (
    <div className="panel-elevated relative overflow-hidden flex flex-col h-[400px] grain">
      {/* Ambient glow */}
      <div className="absolute -top-16 -right-16 w-40 h-40 bg-neon/5 rounded-full blur-[60px] pointer-events-none" />
      
      <div className="px-5 py-3.5 flex items-center justify-between relative z-10 shrink-0 border-b border-edge">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="w-2 h-2 rounded-full bg-neon block shadow-[0_0_6px_rgba(0,229,114,0.5)] animate-pulseDot" />
          </div>
          <span className="label text-xs">
            <Glossary term="Live Feed" def="Real-time stream of all buys, sells, and token launches across the network." category="beginner">
              Market Data
            </Glossary>
          </span>
        </div>
        <div className="flex items-center bg-white/[0.055] border border-edge rounded-lg p-0.5 text-[11px] font-black uppercase tracking-widest">
          {(["LIVE", "TODAY", "WEEK", "MONTH"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md transition-all ${filter === f ? "bg-white/[0.1] text-ink" : "text-mute hover:text-ink"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {!loaded ? (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="text-xs text-mute uppercase tracking-widest animate-pulse font-bold">Syncing market data…</div>
        </div>
      ) : !baseEvents.length ? (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="text-sm text-mute mb-1 font-bold">No market activity</div>
          <div className="text-[11px] text-mute">Trades will appear here in real-time.</div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/[0.06] scroll-smooth relative z-10 no-scrollbar"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence initial={false}>
            {feedEvents.map((e, i) => {
              const c = colorFor(e.kind);
              const p = e.payload || {};
              const isWhale = (e.kind === "BUY" || e.kind === "SELL") && ((p.tokens || 0) * (p.price || 0) > 50 || p.tokens > 500);
              const href = p.mint ? `/coin/${p.mint}` : p.songId ? `/song/${p.songId}` : undefined;
              const related = events
                .filter((x) => x.id !== e.id)
                .filter((x) => {
                  const xp = x.payload || {};
                  if (p.mint && xp.mint) return xp.mint === p.mint;
                  if (p.symbol && xp.symbol) return xp.symbol === p.symbol;
                  return false;
                })
                .slice(0, 4);
              const isExpanded = detailMode || expandedId === e.id;
              const solscan = p.mint ? `https://solscan.io/token/${p.mint}` : p.wallet ? `https://solscan.io/account/${p.wallet}` : null;
              const birdeye = p.mint ? `https://birdeye.so/token/${p.mint}?chain=solana` : null;

              return (
                <motion.li
                  key={`${e.id}-${i}`}
                  initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.01, ease: "easeOut" }}
                  className={`hover:bg-white/[0.06] transition-all relative ${isWhale ? "bg-gold/[0.04]" : ""}`}
                >
                  {detailMode ? (
                    <div className="w-full px-5 py-3 flex items-center gap-3 relative text-left">
                      {isWhale && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold/40" />}
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-edge bg-panel2 shrink-0">
                        <SafeImage src={e.song?.artworkUrl || p.logo_uri || null} alt={e.song?.symbol || p.symbol || e.kind} fill sizes="40px" fallback={e.song?.symbol || p.symbol || e.kind} className="object-cover" />
                      </div>
                      <div className="w-14 shrink-0">
                        <span className={`chip w-full justify-center text-[11px] ${c}`}>{e.kind}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] text-mute px-1.5 py-0.5 rounded bg-white/[0.055] border border-edge font-mono uppercase tracking-widest shrink-0">{e.song?.symbol || p.symbol || "SYS"}</span>
                          {p.wallet && <span className="text-[11px] text-mute font-mono truncate">{shortWallet(p.wallet)}</span>}
                          {isWhale && <span className="text-[11px] bg-gold/10 text-gold border border-gold/20 px-1.5 py-0.5 rounded uppercase tracking-widest font-black animate-pulse">Whale</span>}
                        </div>
                        <div className="truncate text-ink text-sm mt-1 font-medium tracking-tight">{summary(e)}</div>
                      </div>
                      <span className="text-[11px] text-mute num shrink-0 uppercase tracking-widest font-bold">{relTime(e.createdAt)}</span>
                    </div>
                  ) : href ? (
                    <Link href={href} className="w-full px-5 py-3 flex items-center gap-3 relative text-left">
                      {isWhale && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold/40" />}
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-edge bg-panel2 shrink-0">
                        <SafeImage src={e.song?.artworkUrl || p.logo_uri || null} alt={e.song?.symbol || p.symbol || e.kind} fill sizes="40px" fallback={e.song?.symbol || p.symbol || e.kind} className="object-cover" />
                      </div>
                      <div className="w-14 shrink-0">
                        <span className={`chip w-full justify-center text-[11px] ${c}`}>{e.kind}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] text-mute px-1.5 py-0.5 rounded bg-white/[0.055] border border-edge font-mono uppercase tracking-widest shrink-0">{e.song?.symbol || p.symbol || "SYS"}</span>
                          {p.wallet && <span className="text-[11px] text-mute font-mono truncate">{shortWallet(p.wallet)}</span>}
                          {isWhale && <span className="text-[11px] bg-gold/10 text-gold border border-gold/20 px-1.5 py-0.5 rounded uppercase tracking-widest font-black animate-pulse">Whale</span>}
                        </div>
                        <div className="truncate text-ink text-sm mt-1 font-medium tracking-tight">{summary(e)}</div>
                      </div>
                      <span className="text-[11px] text-mute num shrink-0 uppercase tracking-widest font-bold">{relTime(e.createdAt)}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpandedId((cur) => cur === e.id ? null : e.id)}
                      className="w-full px-5 py-3 flex items-center gap-3 relative text-left"
                    >
                      {isWhale && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold/40" />}
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-edge bg-panel2 shrink-0">
                        <SafeImage src={e.song?.artworkUrl || p.logo_uri || null} alt={e.song?.symbol || p.symbol || e.kind} fill sizes="40px" fallback={e.song?.symbol || p.symbol || e.kind} className="object-cover" />
                      </div>
                      <div className="w-14 shrink-0">
                        <span className={`chip w-full justify-center text-[11px] ${c}`}>{e.kind}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] text-mute px-1.5 py-0.5 rounded bg-white/[0.055] border border-edge font-mono uppercase tracking-widest shrink-0">{e.song?.symbol || p.symbol || "SYS"}</span>
                          {p.wallet && <span className="text-[11px] text-mute font-mono truncate">{shortWallet(p.wallet)}</span>}
                          {isWhale && <span className="text-[11px] bg-gold/10 text-gold border border-gold/20 px-1.5 py-0.5 rounded uppercase tracking-widest font-black animate-pulse">Whale</span>}
                        </div>
                        <div className="truncate text-ink text-sm mt-1 font-medium tracking-tight">{summary(e)}</div>
                      </div>
                      <span className="text-[11px] text-mute num shrink-0 uppercase tracking-widest font-bold">{relTime(e.createdAt)}</span>
                    </button>
                  )}

                  <AnimatePresence initial={false}>
                    {detailMode || isExpanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/[0.06] bg-white/[0.03]"
                      >
                        <div className="px-5 py-4 space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {href ? (
                              <Link href={href} className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-ink hover:bg-panel2 transition">
                                Open Token
                              </Link>
                            ) : null}
                            {solscan ? (
                              <a href={solscan} target="_blank" rel="noreferrer" className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-ink hover:bg-panel2 transition">
                                Solscan
                              </a>
                            ) : null}
                            {birdeye ? (
                              <a href={birdeye} target="_blank" rel="noreferrer" className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-ink hover:bg-panel2 transition">
                                Birdeye
                              </a>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <div className="text-[11px] uppercase tracking-widest font-black text-mute">Related Trades</div>
                            {related.length ? (
                              <div className="space-y-2">
                                {related.map((item) => {
                                  const itemPayload = item.payload || {};
                                  const itemSolscan = itemPayload.mint ? `https://solscan.io/token/${itemPayload.mint}` : itemPayload.wallet ? `https://solscan.io/account/${itemPayload.wallet}` : null;
                                  const itemBirdeye = itemPayload.mint ? `https://birdeye.so/token/${itemPayload.mint}?chain=solana` : null;
                                  return (
                                    <div key={item.id} className="rounded-xl border border-edge bg-panel/80 px-3 py-2.5 flex items-center gap-3">
                                      <span className={`chip shrink-0 text-[11px] ${colorFor(item.kind)}`}>{item.kind}</span>
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium text-ink">{summary(item)}</div>
                                        <div className="text-[11px] uppercase tracking-widest text-mute font-bold mt-1">{relTime(item.createdAt)}</div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {itemSolscan ? <a href={itemSolscan} target="_blank" rel="noreferrer" className="text-[11px] uppercase tracking-widest font-black text-neon hover:text-white transition">Solscan</a> : null}
                                        {itemBirdeye ? <a href={itemBirdeye} target="_blank" rel="noreferrer" className="text-[11px] uppercase tracking-widest font-black text-violet hover:text-white transition">Birdeye</a> : null}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-[11px] text-mute">No additional trades loaded for this token yet.</div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </div>
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
    case "MOVE":
      return `${p.artist ?? "Artist Token"} · ${fmtNum(p.trades ?? 0)} trades · $${fmtNum(p.volumeUsd ?? 0)} volume · ${Number(p.change ?? 0) >= 0 ? "+" : ""}${Number(p.change ?? 0).toFixed(2)}%`;
    default:
      return "";
  }
}

function colorFor(k: string): string {
  if (k === "BUY") return "text-neon border-neon/20 bg-neon/5";
  if (k === "SELL") return "text-red border-red/20 bg-red/5";
  if (k === "LAUNCH") return "text-cyan border-cyan/20 bg-cyan/5";
  if (k === "ROYALTY") return "text-violet border-violet/20 bg-violet/5";
  if (k === "MOVE") return "text-gold border-gold/20 bg-gold/5";
  return "text-mute border-edge bg-white/[0.055]";
}

function shortWallet(w?: string): string {
  if (!w) return "";
  return w.length > 10 ? `${w.slice(0, 4)}...${w.slice(-4)}` : w;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
