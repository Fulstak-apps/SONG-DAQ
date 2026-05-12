"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Crown,
  Diamond,
  Eye,
  Flame,
  LineChart,
  Lock,
  Music,
  Radar,
  Rocket,
  Signal,
  Sparkles,
  Target,
  Trophy,
  Unlock,
} from "lucide-react";
import { InfoTooltip } from "@/components/Tooltip";
import {
  assetId,
  assetTicker,
  type BadgeRarity,
  type GamifiedAsset,
  getHypeScore,
  getMilestones,
  getSongIPO,
  getSongIPOs,
  getUndervaluedSignals,
  getUserBadges,
  type HypeScore,
  type SongIPO,
  type UndervaluedSignal,
  type UserBadge,
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

function rarityClass(rarity: BadgeRarity) {
  switch (rarity) {
    case "Legendary":
      return "border-gold/35 bg-gold/10 text-gold";
    case "Epic":
      return "border-violet/35 bg-violet/10 text-violet";
    case "Rare":
      return "border-cyan/35 bg-cyan/10 text-cyan";
    default:
      return "border-neon/25 bg-neon/8 text-neon";
  }
}

function badgeIcon(icon: string, className = "") {
  const props = { size: 18, className };
  if (icon === "diamond") return <Diamond {...props} />;
  if (icon === "target") return <Target {...props} />;
  if (icon === "paper") return <BadgeDollarSign {...props} />;
  if (icon === "crown") return <Crown {...props} />;
  if (icon === "music") return <Music {...props} />;
  if (icon === "eye") return <Eye {...props} />;
  if (icon === "exit") return <LineChart {...props} />;
  if (icon === "flame") return <Flame {...props} />;
  if (icon === "signal") return <Signal {...props} />;
  if (icon === "ipo") return <Rocket {...props} />;
  if (icon === "unlock") return <Unlock {...props} />;
  if (icon === "100") return <Trophy {...props} />;
  return <Sparkles {...props} />;
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

export function BadgeCard({ badge, compact = false }: { badge: UserBadge; compact?: boolean }) {
  const cls = rarityClass(badge.rarity);
  return (
    <article className={`rounded-2xl border bg-panel2 ${compact ? "p-3" : "p-4"} ${badge.unlocked ? cls : "border-edge text-mute"}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${badge.unlocked ? cls : "border-edge bg-white/[0.045] text-mute"}`}>
          {badge.unlocked ? badgeIcon(badge.icon) : <Lock size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-black text-ink">{badge.name}</h4>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${cls}`}>{badge.rarity}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-mute">{badge.unlockCondition}</p>
          {badge.mode === "paper" && (
            <span className="mt-2 inline-flex rounded-full border border-neon/25 bg-neon/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-neon">
              Paper Mode
            </span>
          )}
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-mute">
          <span>{badge.unlocked ? "Unlocked" : "Progress"}</span>
          <span>{badge.progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className={`h-full rounded-full ${badge.unlocked ? "bg-neon" : "bg-violet"}`} style={{ width: `${badge.progress}%` }} />
        </div>
        {badge.dateEarned && <div className="mt-2 text-[11px] text-mute">Earned {new Date(badge.dateEarned).toLocaleDateString()}</div>}
      </div>
    </article>
  );
}

export function BadgeRail({
  asset,
  mode = "live",
  portfolioValueUsd = 0,
  limit = 6,
}: {
  asset?: GamifiedAsset | null;
  mode?: "paper" | "live";
  portfolioValueUsd?: number;
  limit?: number;
}) {
  const items = useMemo(() => getUserBadges({ asset, mode, portfolioValueUsd }).slice(0, limit), [asset, mode, portfolioValueUsd, limit]);
  return (
    <section className="panel-elevated grain p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-mute">
            Rare Badges
            <InfoTooltip def="Badges mark investing milestones like early backing, Paper Mode wins, IPO participation, and finding songs before momentum shows up." />
          </div>
          <h3 className="mt-1 text-xl font-black text-ink">Collectible investing achievements</h3>
        </div>
        <span className="chip-neon">{items.filter((b) => b.unlocked).length} unlocked</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((badge) => <BadgeCard key={`${badge.id}-${badge.mode}`} badge={badge} />)}
      </div>
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
        First 100 Backers badge eligibility is active while early backer spots remain.
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

export function MilestoneGrid({ asset, compact = false }: { asset?: GamifiedAsset | null; compact?: boolean }) {
  const items = useMemo(() => getMilestones(asset).slice(0, compact ? 4 : 6), [asset, compact]);
  return (
    <section className="panel-elevated grain p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-mute">
            Milestone Unlocks
            <InfoTooltip def="Milestones celebrate real progress: streams, investors, volume, royalty events, and hype spikes. They can unlock badge progress." />
          </div>
          <h3 className="mt-1 text-xl font-black text-ink">Progress that unlocks rewards</h3>
        </div>
        <span className="chip text-gold border-gold/25 bg-gold/10">{items.filter((m) => m.progress >= 100).length} unlocked</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((m) => (
          <article key={m.id} className="rounded-2xl border border-edge bg-panel2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-neon/25 bg-neon/10 text-neon">
                {m.progress >= 100 ? <CheckCircle2 size={18} /> : <CalendarClock size={18} />}
              </div>
              {m.relatedBadge && <span className="chip text-violet border-violet/25 bg-violet/10">{m.relatedBadge}</span>}
            </div>
            <h4 className="mt-4 text-base font-black text-ink">{m.name}</h4>
            <p className="mt-1 text-xs leading-relaxed text-mute">Reward: {m.reward}</p>
            <div className="mt-4 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-mute">
              <span>{m.progress >= 100 ? "Unlocked" : "Progress"}</span>
              <span>{m.progress}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-neon" style={{ width: `${m.progress}%` }} />
            </div>
            {m.dateUnlocked && <div className="mt-2 text-[11px] text-mute">Unlocked {new Date(m.dateUnlocked).toLocaleDateString()}</div>}
          </article>
        ))}
      </div>
    </section>
  );
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
          <div className="panel-elevated grain p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-mute">Recently Earned Badges</div>
            <div className="mt-3 grid gap-2">
              {getUserBadges({ asset: top[0], mode: "live" }).slice(0, 3).map((badge) => <BadgeCard key={badge.id} badge={badge} compact />)}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <SongIPOPanel assets={assets} limit={3} />
          <MilestoneGrid asset={top[0]} compact />
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
      <BadgeRail asset={asset} limit={compact ? 3 : 6} />
      <MilestoneGrid asset={asset} compact={compact} />
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
