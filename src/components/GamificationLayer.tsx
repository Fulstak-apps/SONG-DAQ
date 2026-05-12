"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  Radar,
} from "lucide-react";
import { InfoTooltip } from "@/components/Tooltip";
import {
  type GamifiedAsset,
  getHypeScore,
  getSongIPO,
  getSongIPOs,
  getUndervaluedSignals,
  type HypeScore,
  type SongIPO,
  type UndervaluedSignal,
} from "@/lib/gamification";

function fmtUsd(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "$0";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) return `$${value.toFixed(6)}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(value);
}

function fmtCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function levelClass(level: HypeScore["level"]) {
  if (level === "Viral Risk") return "text-red border-red/25 bg-red/10";
  if (level === "On Fire") return "text-neon border-neon/25 bg-neon/10";
  if (level === "Hot") return "text-gold border-gold/25 bg-gold/10";
  if (level === "Warming Up") return "text-cyan border-cyan/25 bg-cyan/10";
  return "text-mute border-edge bg-white/[0.045]";
}

export function HypeMeterCard({ asset, compact = false }: { asset?: GamifiedAsset | null; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const hype = useMemo(() => getHypeScore(asset), [asset]);
  return (
    <section className={`panel-elevated grain ${compact ? "p-4" : "p-5 md:p-6"} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-mute">
            Hype Meter
            <InfoTooltip def="Hype Meter compresses market, music, and social momentum into one score. It is a discovery signal, not financial advice." />
          </div>
          <h3 className="mt-2 text-2xl font-black text-ink">{hype.score}/100</h3>
        </div>
        <span className={`chip ${levelClass(hype.level)}`}>{hype.level}</span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full border border-edge bg-white/[0.055]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan via-neon to-gold shadow-[0_0_18px_rgba(183,255,0,0.35)]"
          style={{ width: `${hype.score}%` }}
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-mute">
        <span className="font-black text-ink">Reason:</span> {hype.reason}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neon"
      >
        Why this score? <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-4 grid gap-2">
          {hype.breakdown.map((item) => (
            <div key={item.label} className="rounded-xl border border-edge bg-panel p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-mute">{item.label}</span>
                <span className="font-mono text-sm font-black text-ink">{item.value}/100</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-neon" style={{ width: `${item.value}%` }} />
              </div>
              <div className="mt-2 text-xs leading-relaxed text-mute">{item.detail}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function IPOCard({ ipo, compact = false }: { ipo: SongIPO; compact?: boolean }) {
  return (
    <article className={`rounded-2xl border border-edge bg-panel2 ${compact ? "p-4" : "p-5"} overflow-hidden`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neon">Song IPO</div>
          <h4 className="mt-2 text-lg font-black text-ink break-words">${ipo.ticker} · {ipo.title}</h4>
          <p className="mt-1 text-sm text-mute">{ipo.artist}</p>
        </div>
        <span className="chip text-neon border-neon/25 bg-neon/10">{ipo.status}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Mini label="Countdown" value={ipo.countdownLabel} />
        <Mini label="Launch Price" value={fmtUsd(ipo.launchPriceUsd, 6)} />
        <Mini label="Royalty Pool" value={`${ipo.royaltyPoolPercentage}%`} />
        <Mini label="Supply" value={fmtCompact(ipo.tokenSupply)} />
      </div>
      <div className="mt-4 rounded-xl border border-neon/20 bg-neon/8 p-3 text-xs leading-relaxed text-neon/90">
        Early launch access is active while opening market spots remain.
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn h-9 px-3 text-[11px] uppercase tracking-widest font-black"><Bell size={12} /> Reminder</button>
        <Link href={`/coin/${ipo.assetId}`} className="btn-primary h-9 px-3 text-[11px] uppercase tracking-widest font-black">View Song</Link>
      </div>
    </article>
  );
}

export function SongIPOPanel({ assets = [], limit = 3 }: { assets?: GamifiedAsset[]; limit?: number }) {
  const ipos = useMemo(() => getSongIPOs(assets, limit), [assets, limit]);
  return (
    <section className="panel-elevated grain p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-mute">
            Song IPO Events
            <InfoTooltip def="A Song IPO is the market debut for a new song coin: launch price, early backer limit, status, and first-day performance in one place." />
          </div>
          <h3 className="mt-1 text-xl font-black text-ink">Music market debuts</h3>
        </div>
        <span className="chip text-violet border-violet/25 bg-violet/10">{ipos.length} launches</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {ipos.map((ipo) => <IPOCard key={ipo.id} ipo={ipo} compact />)}
      </div>
    </section>
  );
}

export function SongIPOStatusCard({ asset }: { asset?: GamifiedAsset | null }) {
  return <IPOCard ipo={getSongIPO(asset)} />;
}

function SignalCard({ signal }: { signal: UndervaluedSignal }) {
  return (
    <article className="rounded-2xl border border-edge bg-panel2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan">{signal.signalName}</div>
          <h4 className="mt-2 text-base font-black text-ink break-words">${signal.ticker} · {signal.title}</h4>
          <p className="mt-1 text-sm text-mute">{signal.artist}</p>
        </div>
        <span className="chip text-cyan border-cyan/25 bg-cyan/10">{signal.confidence}%</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-mute">{signal.explanation}</p>
      <div className="mt-3 grid gap-2">
        {signal.dataPoints.slice(0, 3).map((point) => (
          <div key={point} className="flex gap-2 text-xs leading-relaxed text-mute">
            <Radar size={13} className="mt-0.5 shrink-0 text-cyan" />
            <span>{point}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-amber/20 bg-amber/10 p-3 text-xs leading-relaxed text-amber/90">
        {signal.riskNote}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn h-9 px-3 text-[11px] uppercase tracking-widest font-black">Watchlist</button>
        <Link href={`/coin/${signal.assetId}`} className="btn-primary h-9 px-3 text-[11px] uppercase tracking-widest font-black">View Song</Link>
      </div>
    </article>
  );
}

export function UndervaluedSignalsPanel({ assets = [], limit = 3 }: { assets?: GamifiedAsset[]; limit?: number }) {
  const signals = useMemo(() => getUndervaluedSignals(assets, limit), [assets, limit]);
  return (
    <section className="panel-elevated grain p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-mute">
            Undervalued Signals
            <InfoTooltip def="Signals look for songs where attention is rising faster than investor activity. They are discovery tools, not financial advice." />
          </div>
          <h3 className="mt-1 text-xl font-black text-ink">Opportunity discovery</h3>
        </div>
        <span className="chip text-cyan border-cyan/25 bg-cyan/10">Discovery only</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {signals.map((signal) => <SignalCard key={signal.id} signal={signal} />)}
      </div>
    </section>
  );
}

export function GamifiedMarketOverview({ assets = [] }: { assets?: GamifiedAsset[] }) {
  const top = useMemo(() => [...assets].sort((a, b) => getHypeScore(b).score - getHypeScore(a).score).slice(0, 3), [assets]);
  return (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3">
          <HypeMeterCard asset={top[0]} compact />
        </div>
        <div className="space-y-3">
          <SongIPOPanel assets={assets} limit={3} />
          <UndervaluedSignalsPanel assets={assets} limit={3} />
        </div>
      </section>
    </div>
  );
}

export function GamifiedCoinDetail({ asset, compact = false }: { asset?: GamifiedAsset | null; compact?: boolean }) {
  const one = asset ? [asset] : [];
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <HypeMeterCard asset={asset} compact={compact} />
        <SongIPOStatusCard asset={asset} />
      </section>
      <UndervaluedSignalsPanel assets={one} limit={1} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[11px] font-black uppercase tracking-widest text-mute">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-black text-ink">{value}</div>
    </div>
  );
}
