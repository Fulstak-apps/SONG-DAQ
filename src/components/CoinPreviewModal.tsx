"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, ExternalLink, Pause, Play, ShieldCheck, Star, X } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { RiskBadge } from "./RiskBadge";
import { PriceChart, type PricePointDTO } from "./PriceChart";
import { usePlayer, useWatchlist, type PlayerTrack } from "@/lib/store";
import { toast } from "@/lib/toast";
import { CHART_RANGE_LABELS, CHART_RANGES, isFastRange, type ChartRange } from "@/lib/chartRanges";
import { fmtNum, fmtPct } from "@/lib/pricing";
import type { AudiusCoin } from "@/lib/audiusCoins";

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

function fmtUsd(n: number, digits = 4) {
  if (!isFinite(n)) return "-";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(digits)}`;
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
  const { current, playing, playTrack, toggle } = usePlayer();
  const watchlist = useWatchlist();
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
    let alive = true;
    const load = () => fetch(`/api/coins/${coin.mint}/history?range=${range}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive) {
          setPoints((j.candles?.length ? j.candles : coin?.price ? [{
            ts: new Date().toISOString(),
            open: coin.price,
            high: coin.price,
            low: coin.price,
            close: coin.price,
            volume: 0,
          }] : []) as PricePointDTO[]);
          setRecentTrades(j.trades ?? []);
        }
      })
      .catch(() => {
        if (alive) {
          setPoints(coin?.price ? [{
            ts: new Date().toISOString(),
            open: coin.price,
            high: coin.price,
            low: coin.price,
            close: coin.price,
            volume: 0,
          }] : []);
          setRecentTrades([]);
        }
      });
    load();
    const i = setInterval(load, isFastRange(range) ? 1_000 : 6_000);
    return () => { alive = false; clearInterval(i); };
  }, [coin?.mint, range]);

  useEffect(() => {
    if (!coin) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [coin]);

  if (!coin) return null;
  const activeCoin = coin;
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
    id: String(coin.audius_track_id),
    title: coin.audius_track_title ?? coin.name,
    artist: coin.artist_name ?? coin.name,
    artwork: coin.audius_track_artwork ?? coin.logo_uri ?? null,
    streamUrl: audioUrl,
    href: `/coin/${coin.mint}`,
  } : null;
  const isPlayingThis = !!playerTrack && current?.id === playerTrack.id && playing;
  const watched = watchlist.items.includes(coin.mint);

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
        className="fixed inset-0 z-50 grid items-start justify-items-center overflow-y-auto bg-pure-black/60 backdrop-blur-xl p-2 sm:place-items-center sm:p-5 overscroll-contain"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
          className="w-full max-w-full sm:w-[1040px] max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] overflow-y-auto overscroll-contain rounded-2xl sm:rounded-3xl border border-edge bg-panel text-ink shadow-[0_24px_90px_rgba(0,0,0,0.62)] grain"
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
                <span className="rounded-md border border-neon/20 bg-neon/10 px-2 py-0.5 text-[9px] uppercase tracking-widest font-black text-neon">Artist Token</span>
                <RiskBadge coin={coin as any} compact />
                <span className="rounded-md border border-violet/20 bg-violet/10 px-2 py-0.5 text-[9px] uppercase tracking-widest font-black text-violet">
                  {coin.audius_track_id ? "Audius linked" : "Artist coin"}
                </span>
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
                <span className="text-2xl sm:text-3xl font-mono font-black">{fmtUsd(coin.price ?? 0, 6)}</span>
                <span className={`num text-sm font-black ${change >= 0 ? "text-neon" : "text-red"}`}>
                  {change >= 0 ? "+" : ""}{fmtPct(change)} 24h
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-panel2 px-2.5 py-1 text-[9px] uppercase tracking-widest font-black text-mute">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulseDot" /> Live
                </span>
              </div>
            </div>
            <button onClick={onClose} className="absolute right-4 top-4 h-9 w-9 rounded-xl border border-edge bg-panel2 text-mute hover:text-ink hover:bg-white/10 transition grid place-items-center">
              <X size={15} />
            </button>
          </header>

          <section className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 border-b border-edge p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="text-[10px] uppercase tracking-widest font-black text-mute">
                  Timeframe: <span className="text-neon">{CHART_RANGE_LABELS[range]}</span>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-2">
                  <div className="flex max-w-full gap-1 overflow-x-auto no-scrollbar rounded-xl border border-edge bg-panel2 p-1">
                    {CHART_RANGES.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${
                          range === r ? "bg-neon/15 text-neon border border-neon/25" : "text-mute hover:text-ink hover:bg-white/10"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="flex rounded-xl border border-edge bg-panel2 p-1 text-[9px] font-black uppercase tracking-widest">
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
              <div className="h-[300px] overflow-hidden rounded-2xl border border-edge bg-panel2/60 p-2 sm:h-[360px]">
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
                <Metric label="Market Value" value={fmtUsd(coin.marketCap ?? 0, 0)} />
                <Metric label="Volume" value={fmtUsd(coin.v24hUSD ?? 0, 0)} />
                <Metric label="Holders" value={fmtNum(coin.holder ?? 0)} />
                <Metric label="Liquidity" value={fmtUsd(coin.liquidity ?? 0, 0)} />
                <Metric label="Supply" value={fmtNum(coin.totalSupply ?? 0)} />
                <Metric label="Available" value={fmtNum(coin.circulatingSupply ?? 0)} />
                <Metric label="Markets" value={String((coin as any).numberMarkets ?? 1)} />
                <Metric label="Royalty" value={(coin as any).splitsLocked ? "Locked" : "Pending"} accent={(coin as any).splitsLocked ? "text-neon" : "text-amber"} />
              </div>
            </div>

            <aside className="min-w-0 bg-panel2/60 p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary h-11 text-[10px] font-black uppercase tracking-widest" onClick={() => trade("BUY")}>Buy</button>
                <button className="btn h-11 text-[10px] font-black uppercase tracking-widest" disabled={isOwner} onClick={() => trade("SELL")}>Sell</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn h-10 text-[10px] uppercase tracking-widest font-black"
                  onClick={toggleAudio}
                >
                  {isPlayingThis ? <Pause size={13} /> : <Play size={13} />}
                  {isPlayingThis ? "Pause" : "Play"}
                </button>
                <button
                  className={`btn h-10 text-[10px] uppercase tracking-widest font-black ${watched ? "text-gold border-gold/30" : ""}`}
                  onClick={() => watchlist.toggle(coin.mint)}
                >
                  <Star size={13} fill={watched ? "currentColor" : "none"} />
                  {watched ? "Watching" : "Watch"}
                </button>
              </div>

              <div className="rounded-2xl border border-edge bg-panel p-4 space-y-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-mute">
                  <ShieldCheck size={13} className="text-neon" />
                  Security & Trust
                </div>
                <div className="grid gap-2 text-[11px] text-mute">
                  <TrustLine ok label="Solana SPL token" />
                  <TrustLine ok={!!coin.artist_handle} label={coin.artist_handle ? "Audius artist resolved" : "Audius profile pending"} />
                  <TrustLine ok={(coin as any).splitsLocked} label={(coin as any).splitsLocked ? "Royalty splits locked" : "Royalty splits pending"} />
                </div>
              </div>

              <div className="rounded-2xl border border-edge bg-panel p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-widest font-black text-mute">Contract Preview</div>
                <button onClick={copyMint} className="w-full rounded-xl border border-edge bg-panel2 p-3 text-left font-mono text-xs text-ink hover:border-neon/30 transition flex items-center justify-between gap-2">
                  <span className="truncate">{short(coin.mint)}</span>
                  <Copy size={13} className="text-mute" />
                </button>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/coin/${coin.mint}`} className="btn h-9 px-3 text-[10px] uppercase tracking-widest font-black">
                    <ExternalLink size={13} /> Full page
                  </Link>
                  {coin.artist_handle && (
                    <a href={`https://audius.co/${coin.artist_handle}`} target="_blank" rel="noreferrer" className="btn h-9 px-3 text-[10px] uppercase tracking-widest font-black">
                      Audius
                    </a>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className="mb-3 text-[10px] uppercase tracking-widest font-black text-mute">Recent Movement</div>
                <div className="space-y-2">
                  {txPreview.length ? txPreview.map((p, i) => (
                    <div key={`${p.id ?? p.createdAt}-${i}`} className="rounded-xl border border-edge bg-panel2/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-widest font-black text-mute">
                            {new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </div>
                          <div className={`mt-1 text-[10px] uppercase tracking-widest font-black ${p.side === "BUY" ? "text-neon" : "text-red"}`}>
                            {p.side} {p.amount ? `${fmtNum(p.amount)} ${coin.ticker}` : coin.ticker}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-ink">{fmtUsd(p.priceUsd, 6)}</div>
                          {p.totalUsd ? <div className="text-[10px] uppercase tracking-widest text-mute font-black">{fmtUsd(p.totalUsd, 2)}</div> : null}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {p.txSig ? (
                          <a
                            href={`https://solscan.io/tx/${p.txSig}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-neon/20 bg-neon/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-neon hover:bg-neon/15 transition"
                          >
                            Solscan Tx
                          </a>
                        ) : (
                          <a
                            href={`/coin/${coin.mint}`}
                            className="rounded-lg border border-edge bg-panel px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-ink hover:bg-panel transition"
                          >
                            Coin Page
                          </a>
                        )}
                        {p.wallet ? (
                          <a
                            href={`https://solscan.io/account/${p.wallet}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-edge bg-panel px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-ink hover:bg-panel transition"
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
      <div className="text-[9px] uppercase tracking-widest text-mute font-black truncate">{label}</div>
      <div className={`mt-1 font-mono font-bold text-ink truncate ${accent ?? ""}`}>{value}</div>
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
