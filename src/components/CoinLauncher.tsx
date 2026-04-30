"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/lib/store";
import { api } from "@/lib/api";
import { fmtSol, fmtNum } from "@/lib/pricing";
import { spotPrice } from "@/lib/bondingCurve";
import { computePerformance } from "@/lib/pricing";
import {
  DEFAULT_ROYALTY,
  validateRoyalty,
  type RoyaltyConfig,
} from "@/lib/royaltyConfig";
import { RoyaltyConfigEditor } from "./RoyaltyConfigEditor";
import type { AudiusTrack } from "@/lib/audius";
import { Glossary } from "@/components/Tooltip";
import { ChevronRight, ChevronLeft, Rocket, Music, Settings, BarChart3, ShieldCheck, CheckCircle2 } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

export function CoinLauncher({ onLaunched }: { onLaunched?: () => void }) {
  const { address, kind, audius } = useSession();
  const [step, setStep] = useState<Step>(1);

  // Step 1: track selection
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [pick, setPick] = useState<AudiusTrack | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [trackErr, setTrackErr] = useState<string | null>(null);

  // Step 2: tokenomics
  const [supply, setSupply] = useState(1_000_000);
  const [basePrice, setBasePrice] = useState(0.001);
  const [curveSlope, setCurveSlope] = useState(0.0000005);
  const [distributor, setDistributor] = useState<string>("");
  const [royalty, setRoyalty] = useState<RoyaltyConfig>(DEFAULT_ROYALTY);

  // Step 4
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!audius?.handle) return;
    setLoadingTracks(true); setTrackErr(null);
    fetch(`/api/audius/search?q=${encodeURIComponent(audius.handle)}`)
      .then((r) => r.json())
      .then((j) => {
        const mine = (j.tracks || []).filter((t: any) => String(t.user?.id) === String(audius.userId));
        setTracks(mine);
      })
      .catch((e) => setTrackErr(e.message))
      .finally(() => setLoadingTracks(false));
  }, [audius?.userId, audius?.handle]);

  const royaltyValid = validateRoyalty(royalty).ok;
  const canStep2 = !!pick;
  const canStep3 = canStep2 && royaltyValid && supply >= 1_000 && basePrice > 0 && curveSlope >= 0 && !!distributor;

  const previewSeries = useMemo(() => {
    const arr: { x: number; y: number }[] = [];
    const perf = pick
      ? computePerformance({
          streams: pick.play_count ?? 0,
          likes: pick.favorite_count ?? 0,
          reposts: pick.repost_count ?? 0,
          volume24h: 0,
          hoursSinceLaunch: 1,
        })
      : 1;
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const c = (supply * i) / steps;
      arr.push({
        x: c,
        y: spotPrice({ basePrice, slope: curveSlope, circulating: c, performance: perf }),
      });
    }
    return arr;
  }, [supply, basePrice, curveSlope, pick]);

  async function deploy() {
    if (!pick || !address) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<any>("/api/songs", {
        method: "POST",
        json: {
          audiusTrackId: pick.id,
          artistWallet: address,
          walletType: kind,
          supply,
          basePrice,
          curveSlope,
          distributor,
          royalty,
        },
      });
      setResult(r);
      onLaunched?.();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!audius) {
    return (
      <div className="panel p-10 text-center text-white/40 uppercase tracking-widest font-bold text-xs bg-panel2 border-dashed border-white/10">
        Identity Authentication Required to Access Launch Terminal
      </div>
    );
  }

  return (
    <div className="panel p-8 space-y-8 relative overflow-hidden shadow-2xl border border-white/10 bg-panel2 backdrop-blur-xl">
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet/5 rounded-full blur-[100px] pointer-events-none" />
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center border border-neon/20">
              <Rocket className="text-neon" size={20} />
            </div>
            Artist Coin Launch Terminal
          </h2>
          <div className="text-[10px] uppercase tracking-widest font-bold text-white/30">
            Authenticated Issuer: <span className="text-white">@{audius.handle}</span>
          </div>
        </div>
        <Stepper step={step} />
      </header>

      <div className="relative z-10 min-h-[460px]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.section
              key="s1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-white/40">
                <Music size={14} className="text-violet" /> Step 01 — Asset Selection
              </div>
              
              {loadingTracks && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
                  <div className="text-[10px] uppercase tracking-widest font-bold text-white/30">Scanning Audius Catalog…</div>
                </div>
              )}
              
              {trackErr && <div className="panel p-4 bg-red/10 border-red/20 text-red text-xs font-bold uppercase tracking-widest text-center">{trackErr}</div>}
              
              {!loadingTracks && !tracks.length && (
                <div className="panel p-12 text-center space-y-4 bg-white/5 border-dashed border-white/10">
                  <div className="text-white/40 text-sm font-medium leading-relaxed">
                    No compatible master recordings found for @{audius.handle}.
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-white/20">
                    Upload a track to Audius first, then initialize terminal.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {tracks.map((t) => {
                  const art = t.artwork?.["480x480"] || t.artwork?.["150x150"];
                  const selected = pick?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setPick(t)}
                      className={`text-left panel p-4 flex gap-4 transition-all relative overflow-hidden group ${selected ? "border-neon bg-neon/5 shadow-[0_0_20px_rgba(0,229,114,0.15)]" : "border-white/5 hover:border-white/20 bg-black/20"}`}
                    >
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-black shrink-0 shadow-lg">
                        {art ? <Image src={art} alt={t.title} fill sizes="64px" className="object-cover group-hover:scale-110 transition-transform duration-500" /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white truncate group-hover:text-neon transition">{t.title}</div>
                        <div className="mt-2 flex items-center gap-3 text-[10px] font-mono font-bold text-white/40">
                          <span>▶ {fmtNum(t.play_count ?? 0)}</span>
                          <span>♥ {fmtNum(t.favorite_count ?? 0)}</span>
                          <span>↺ {fmtNum(t.repost_count ?? 0)}</span>
                        </div>
                      </div>
                      {selected && <div className="absolute top-2 right-2"><CheckCircle2 className="text-neon" size={16} /></div>}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="s2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-white/40">
                  <Settings size={14} className="text-violet" /> Step 02 — Calibration
                </div>
                <div className="space-y-4">
                  <Field label="Total Issuance" value={supply} onChange={setSupply} step={1000} min={1000} unit="Tokens" />
                  <Field label="Initial Valuation" value={basePrice} onChange={setBasePrice} step={0.0001} min={0} unit="SOL" />
                  <Field label="Growth Coefficient" value={curveSlope} onChange={setCurveSlope} step={0.0000001} min={0} unit="Slope" />
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 px-1">Settlement Distributor</label>
                    <select
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon focus:ring-1 focus:ring-neon transition-all outline-none appearance-none cursor-pointer"
                      value={distributor}
                      onChange={(e) => setDistributor(e.target.value)}
                    >
                      <option value="" disabled>Choose Distributor...</option>
                      <option value="DistroKid">DistroKid</option>
                      <option value="TuneCore">TuneCore</option>
                      <option value="UnitedMasters">UnitedMasters</option>
                      <option value="CD Baby">CD Baby</option>
                      <option value="Other">Other distributor</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-white/40">
                  <ShieldCheck size={14} className="text-neon" /> Royalty Distribution Model
                </div>
                <div className="panel p-6 bg-black/20 border-white/5 rounded-2xl">
                  <RoyaltyConfigEditor value={royalty} onChange={setRoyalty} />
                </div>
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="s3"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-white/40">
                  <BarChart3 size={14} className="text-violet" /> Step 03 — Simulation Preview
                </div>
                <div className="panel p-6 bg-black/40 border-white/10 rounded-2xl space-y-4">
                  <PreviewCurve series={previewSeries} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-widest font-bold text-white/30">Launch Price</div>
                      <div className="font-mono text-sm font-bold text-white">{fmtSol(previewSeries[0]?.y ?? 0, 6)} SOL</div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="text-[9px] uppercase tracking-widest font-bold text-white/30">Terminal Price</div>
                      <div className="font-mono text-sm font-bold text-neon">{fmtSol(previewSeries[previewSeries.length - 1]?.y ?? 0, 6)} SOL</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-white/40">
                  Verification Manifest
                </div>
                <div className="panel p-6 bg-black/20 border-white/5 rounded-2xl space-y-3">
                  <Row k="Asset Reference" v={pick?.title ?? "—"} />
                  <Row k="Protocol ID" v={`$${pick?.title?.slice(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`} />
                  <Row k="Settlement Gateway" v={distributor} />
                  <Row k="Total Supply" v={fmtNum(supply)} />
                  <Row k="Issuance Yield" v={`${(royalty.holderShareBps/100).toFixed(0)}% to Holders`} color="text-neon" />
                  <Row k="Vesting Schedule" v="365 Day Linear" />
                  <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2">
                    {royalty.streamingEnabled && <Tag label="Streaming Active" />}
                    {royalty.tradingFeesEnabled && <Tag label="Trading Fees Active" />}
                    {royalty.externalRevenueEnabled && <Tag label="External Sync Active" />}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {step === 4 && (
            <motion.section
              key="s4"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 space-y-8"
            >
              {!result && !busy && (
                <div className="text-center space-y-6 max-w-md">
                  <div className="w-20 h-20 rounded-3xl bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,229,114,0.2)]">
                    <Rocket className="text-neon" size={40} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black tracking-tighter text-white uppercase">Ready for Deployment</h3>
                    <p className="text-white/50 text-sm font-medium">Initialize the SPL mint, bonding curve, and royalty vault on the Solana network.</p>
                  </div>
                  <button className="btn-primary w-full py-4 text-sm font-black tracking-widest shadow-[0_0_30px_rgba(0,229,114,0.3)]" onClick={deploy}>
                    INITIALIZE ON-CHAIN PROTOCOL
                  </button>
                </div>
              )}
              
              {busy && (
                <div className="text-center space-y-6">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                    <div className="absolute inset-0 border-4 border-neon border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-neon text-lg font-black tracking-tighter uppercase animate-pulse">Synchronizing Ledger…</div>
                    <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold">Deploying SPL mint · initializing vaults</div>
                  </div>
                </div>
              )}
              
              {err && <div className="panel p-4 bg-red/10 border-red/20 text-red text-xs font-bold uppercase tracking-widest text-center max-w-md">{err}</div>}
              
              {result && (
                <div className="text-center space-y-6 max-w-md">
                  <div className="w-20 h-20 rounded-3xl bg-neon/20 border border-neon/50 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(0,229,114,0.4)]">
                    <CheckCircle2 className="text-neon" size={40} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black tracking-tighter text-white uppercase">Asset Verified</h3>
                    <div className="text-white/50 text-sm font-medium">Successfully deployed {result.song?.symbol} to mainnet.</div>
                    <div className="text-white/20 font-mono text-[10px] break-all">{result.song?.mintAddress}</div>
                  </div>
                  <a className="btn-primary block w-full py-4 text-sm font-black tracking-widest" href={`/song/${result.song?.id}`}>OPEN TRADING TERMINAL</a>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <footer className="flex items-center justify-between pt-8 border-t border-white/10 relative z-10">
        <button
          className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold transition-all ${step === 1 ? "opacity-0 pointer-events-none" : "text-white/40 hover:text-white"}`}
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1}
        >
          <ChevronLeft size={14} /> Previous Step
        </button>
        <button
          className="flex items-center gap-2 px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest font-bold text-white hover:bg-white/10 hover:border-neon/50 hover:text-neon transition-all disabled:opacity-30 disabled:grayscale"
          onClick={() => setStep((s) => Math.min(4, s + 1) as Step)}
          disabled={
            (step === 1 && !canStep2) ||
            (step === 2 && !canStep3) ||
            step === 4
          }
        >
          {step === 3 ? "Review Manifest" : "Continue"} <ChevronRight size={14} />
        </button>
      </footer>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Source", "Tokenomics", "Preview", "Deploy"];
  return (
    <div className="flex items-center gap-4">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done = step > idx;
        return (
          <div key={label} className="flex items-center gap-4 group">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-[10px] font-black transition-all ${done ? "bg-neon/20 border-neon/50 text-neon shadow-[0_0_10px_rgba(0,229,114,0.2)]" : active ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "bg-black/40 border-white/10 text-white/30"}`}>
                {idx}
              </div>
            </div>
            {idx < 4 && <div className={`w-8 h-px transition-all ${done ? "bg-neon/50" : "bg-white/10"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label, value, onChange, step, min, unit
}: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; unit: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 px-1 flex justify-between">
        <span>{label}</span>
        <span className="text-white/20 font-mono">{unit}</span>
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-panel border border-white/10 rounded-xl px-4 py-3 text-lg font-mono text-white focus:border-neon focus:ring-1 focus:ring-neon transition-all outline-none"
      />
    </div>
  );
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-[10px] uppercase tracking-widest font-bold text-white/30">{k}</span>
      <span className={`font-mono text-xs font-bold ${color || "text-white"}`}>{v}</span>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="text-[8px] uppercase tracking-widest font-black px-2 py-1 rounded bg-white/5 text-white/40 border border-white/10">{label}</span>;
}

function PreviewCurve({ series }: { series: { x: number; y: number }[] }) {
  const w = 400, h = 180, pad = 20;
  const xs = series.map((p) => p.x), ys = series.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const path = series
    .map((p, i) => {
      const x = pad + ((p.x - xMin) / (xMax - xMin || 1)) * (w - 2 * pad);
      const y = h - pad - ((p.y - yMin) / (yMax - yMin || 1)) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44 drop-shadow-[0_0_15px_rgba(0,229,114,0.1)]">
        <defs>
          <linearGradient id="curveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00E572" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00E572" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L${w - pad},${h - pad} L${pad},${h - pad} Z`} fill="url(#curveGrad)" />
        <path d={path} fill="none" stroke="#00E572" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

