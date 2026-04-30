"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SafeImage } from "./SafeImage";
import { PriceChart, type PricePointDTO } from "./PriceChart";
import { Glossary, WhyDidThisMove } from "./Tooltip";
import { useSession } from "@/lib/store";
import { signMessage } from "@/lib/wallet";
import { toast } from "@/lib/toast";
import { fmtNum, fmtPct } from "@/lib/pricing";
import type { AudiusCoin } from "@/lib/audiusCoins";

function fmtUsd(n: number, d = 4) {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(d)}`;
}

const RANGES = ["1H", "1D", "1W", "ALL"] as const;
type Range = typeof RANGES[number];

export function CoinTradeModal({
  coin,
  side: initialSide,
  onClose,
  onDone,
}: {
  coin: AudiusCoin | null;
  side: "BUY" | "SELL";
  onClose: () => void;
  onDone?: () => void;
}) {
  const { address, kind, provider, audius } = useSession();
  const [side, setSide] = useState<"BUY" | "SELL">(initialSide);
  const [asset, setAsset] = useState<"SOL" | "AUDIO">("SOL");
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [points, setPoints] = useState<PricePointDTO[]>([]);
  const [range, setRange] = useState<Range>("1D");

  useEffect(() => setSide(initialSide), [initialSide]);
  useEffect(() => { setErr(null); setOk(null); }, [coin?.mint, side]);

  useEffect(() => {
    if (!coin?.mint) return;
    let alive = true;
    const load = () =>
      fetch(`/api/coins/${coin.mint}/history?range=${range}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => { if (alive) setPoints(j.candles ?? []); })
        .catch(() => {});
    load();
    const i = setInterval(load, 6_000);
    return () => { alive = false; clearInterval(i); };
  }, [coin?.mint, range]);

  if (!coin) return null;
  const tokens = Number(amount) || 0;
  const price = coin.price ?? 0;
  const total = tokens * price;
  const change = coin.priceChange24hPercent ?? 0;
  const isOwner = !!(audius && audius.userId === coin.owner_id);

  async function submit() {
    if (!address) { setErr("Connect a wallet first"); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      const msg = `SONG-DAQ\n\nConfirm ${side} of ${tokens} $${coin!.ticker} for ${fmtUsd(total, 4)}`;
      const sig = await signMessage(provider as any, msg, address);
      const r = await fetch("/api/coins/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint: coin!.mint, side, amount: tokens, wallet: address, walletType: kind, txSig: sig, asset }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "trade failed");
      const okMsg = `${side === "BUY" ? "Bought" : "Sold"} ${tokens} $${coin!.ticker} @ ${fmtUsd(price, 6)}`;
      setOk(okMsg);
      toast.success(okMsg, `Live price · ${coin!.artist_name ?? coin!.name}`);
      onDone?.();
    } catch (e: any) {
      const m = e.message ?? String(e);
      setErr(m);
      toast.error(`${side} failed`, m);
    }
    finally { setBusy(false); }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-lg p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ scale: 0.95, opacity: 0, y: 24, filter: "blur(4px)" }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
          className="relative w-[860px] max-w-full max-h-[92vh] overflow-hidden rounded-3xl border border-white/[0.06] bg-[#060606]/95 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.9)] grain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="relative flex items-center gap-4 px-6 py-5 border-b border-white/[0.03]">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/[0.06] shrink-0 shadow-lg">
              <SafeImage src={coin.logo_uri} fill sizes="48px" alt={coin.ticker} fallback={coin.ticker} className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none mix-blend-overlay" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="font-black text-xl tracking-tighter text-white">${coin.ticker}</div>
                <div className="text-[10px] text-white/25 truncate uppercase tracking-widest font-bold">{coin.artist_name ?? coin.name}</div>
                {isOwner && <span className="chip-violet text-[8px]">Your coin</span>}
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="font-mono text-lg font-bold tracking-tight text-white">{fmtUsd(price, 6)}</span>
                <span className={`num text-sm font-bold tracking-wider ${change >= 0 ? "text-neon" : "text-red"}`}>
                  {change >= 0 ? "▲" : "▼"} {fmtPct(change)}
                </span>
                <div className="ml-auto flex items-center gap-3">
                  {/* Why Did This Move button */}
                  <WhyDidThisMove symbol={coin.ticker} change={change} />
                  <Link href={`/coin/${coin.mint}`} className="text-[10px] uppercase tracking-widest text-white/15 hover:text-white/40 transition flex items-center gap-1 font-bold">
                    Full view <span className="text-neon">→</span>
                  </Link>
                </div>
              </div>
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition text-white/30 hover:text-white/60" onClick={onClose}>✕</button>
          </header>

          <div className="grid md:grid-cols-[1fr_340px] relative z-10">
            {/* Chart section */}
            <section className="p-6 border-b md:border-b-0 md:border-r border-white/[0.03]">
              <div className="flex items-center justify-between mb-4">
                <div className="label">
                  <Glossary term="Price Chart" def="Real-time bonding curve price derived from on-chain liquidity reserves." category="advanced">
                    Live Price · USD
                  </Glossary>
                </div>
                <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  {RANGES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition ${
                        range === r ? "bg-white/[0.06] text-white" : "text-white/20 hover:text-white/40"
                      }`}
                    >{r}</button>
                  ))}
                </div>
              </div>
              <PriceChart points={points} quote="USD" height={280} />
              
              <div className="grid grid-cols-3 gap-3 mt-6">
                <ChartStat k="MKT CAP" v={fmtUsd(coin.marketCap ?? 0, 0)} tooltip="Total Market Capitalization" />
                <ChartStat k="24H VOL" v={fmtUsd(coin.v24hUSD ?? 0, 0)} tooltip="24 Hour Trading Volume" />
                <ChartStat k="HOLDERS" v={fmtNum(coin.holder ?? 0)} tooltip="Unique Wallets Holding Token" />
              </div>
            </section>

            {/* Trade section */}
            <section className="p-6 space-y-5 bg-white/[0.01]">
              {/* Buy/Sell toggle */}
              <div className="flex bg-white/[0.02] border border-white/[0.04] rounded-xl p-0.5">
                <button
                  onClick={() => setSide("BUY")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    side === "BUY" ? "bg-neon text-[#030303] shadow-[0_0_15px_rgba(0,229,114,0.2)]" : "text-white/20 hover:text-white/40"
                  }`}
                >Buy</button>
                <button
                  onClick={() => setSide("SELL")}
                  disabled={isOwner}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    isOwner ? "opacity-20 cursor-not-allowed" : side === "SELL" ? "bg-red text-white shadow-[0_0_15px_rgba(255,51,102,0.2)]" : "text-white/20 hover:text-white/40"
                  }`}
                  title={isOwner ? "Artists cannot sell their own coin" : ""}
                >Sell</button>
              </div>

              {side === "BUY" && (
                <div className="flex items-center justify-between">
                  <label className="label">
                    <Glossary term="Asset" def="Select the currency you wish to use for this purchase." category="beginner">Pay with</Glossary>
                  </label>
                  <select
                    className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white outline-none cursor-pointer hover:border-white/10 transition"
                    value={asset}
                    onChange={(e) => setAsset(e.target.value as any)}
                  >
                    <option value="SOL">◎ SOL</option>
                    <option value="AUDIO">🎧 AUDIO</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block">
                  <span className="label">Amount (Tokens)</span>
                  <div className="relative mt-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full !bg-white/[0.02] border border-white/[0.04] focus:border-neon/30 focus:ring-1 focus:ring-neon/20 rounded-xl px-4 py-3 text-lg font-mono font-bold text-white transition placeholder-white/10"
                      placeholder="0"
                    />
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      <span className="text-white/15 font-mono text-sm uppercase">${coin.ticker}</span>
                    </div>
                  </div>
                </label>
                <div className="flex gap-2 mt-3">
                  {[100, 1000, 5000, 10000].map((q) => (
                    <button key={q} className="flex-1 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.03] text-[10px] font-mono text-white/25 hover:bg-white/[0.04] hover:text-white/50 transition" onClick={() => setAmount(String(q))}>
                      {fmtNum(q)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order summary */}
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.03] p-4 space-y-2.5">
                <OrderRow k="Execution Price" v={fmtUsd(price, 6)} />
                <OrderRow k={side === "BUY" ? "Total Cost" : "You Receive"} v={fmtUsd(total, 4)} highlight />
                <div className="h-px bg-white/[0.03] w-full" />
                <OrderRow
                  k={<Glossary term="Liquidity" def="Total depth of the bonding curve liquidity pool." category="protocol">Pool Size</Glossary>}
                  v={fmtUsd(coin.liquidity ?? 0, 0)}
                />
              </div>

              {/* Submit button */}
              <button
                className={`w-full py-4 rounded-xl text-sm font-bold tracking-widest uppercase transition-all ${
                  busy ? "opacity-60 cursor-not-allowed bg-white/[0.04] text-white/40" :
                  side === "BUY" ? "bg-neon text-[#030303] hover:bg-[#00FC7D] shadow-[0_0_20px_rgba(0,229,114,0.2)]" :
                  "bg-red text-white hover:bg-[#FF4D79] shadow-[0_0_20px_rgba(255,51,102,0.2)]"
                }`}
                disabled={busy || tokens <= 0 || (side === "SELL" && isOwner)}
                onClick={submit}
              >
                {busy ? "Processing..." : `Confirm ${side}`}
              </button>
              
              {err && <div className="text-red text-[10px] uppercase tracking-widest text-center font-bold bg-red/5 border border-red/10 py-2 rounded-xl">{err}</div>}
              {ok && <div className="text-neon text-[10px] uppercase tracking-widest text-center font-bold bg-neon/5 border border-neon/10 py-2 rounded-xl">{ok}</div>}
              
              <p className="text-[9px] text-white/15 leading-relaxed text-center uppercase tracking-widest">
                Routing via Audius Bonding Curve<br/>
                <span className="font-mono mt-1 inline-block bg-white/[0.02] px-2 py-0.5 rounded border border-white/[0.03]">{coin.mint.slice(0, 8)}…{coin.mint.slice(-6)}</span>
              </p>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function OrderRow({ k, v, highlight }: { k: React.ReactNode; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/25 uppercase tracking-widest text-[9px] font-bold">{k}</span>
      <span className={`font-mono ${highlight ? "text-white font-bold" : "text-white/50"}`}>{v}</span>
    </div>
  );
}

function ChartStat({ k, v, tooltip }: { k: string; v: string; tooltip: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.03] p-3">
      <div className="label">
        <Glossary term={k} def={tooltip} category="financial">{k}</Glossary>
      </div>
      <div className="num text-sm mt-1 text-white font-bold">{v}</div>
    </div>
  );
}
