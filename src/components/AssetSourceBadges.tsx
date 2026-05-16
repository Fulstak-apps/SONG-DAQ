"use client";

import Link from "next/link";
import { BadgeCheck, Clock3, Database, Droplets, Flame, ShieldCheck, Smartphone, WalletCards } from "lucide-react";
import { ASSET_SOURCE_META, inferAssetSources, type AssetSourceKey } from "@/lib/assetSource";
import { Tooltip } from "@/components/Tooltip";
import { fmtNum } from "@/lib/pricing";
import { useUsdToDisplayRate } from "@/lib/fiat";

const toneClass: Record<string, string> = {
  neon: "border-neon/25 bg-neon/10 text-neon",
  violet: "border-violet/25 bg-violet/10 text-violet",
  blue: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  amber: "border-amber/25 bg-amber/10 text-amber",
  muted: "border-edge bg-white/[0.045] text-mute",
};

function short(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function toDateLabel(value: unknown) {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function AssetSourceBadges({
  asset,
  sources,
  compact = false,
}: {
  asset?: Record<string, any> | null;
  sources?: AssetSourceKey[];
  compact?: boolean;
}) {
  const list = sources?.length ? sources : inferAssetSources(asset);
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {list.map((source) => {
        const meta = ASSET_SOURCE_META[source];
        if (!meta) return null;
        return (
          <Tooltip key={source} content={meta.description}>
            <span className={`inline-flex h-7 items-center rounded-full border px-2 text-[10px] font-black uppercase tracking-widest ${toneClass[meta.tone]}`}>
              {compact ? meta.shortLabel : meta.label}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function AssetSyncHealthCard({ asset }: { asset: Record<string, any> }) {
  const { formatUsd } = useUsdToDisplayRate();
  const price = Number(asset.price ?? 0);
  const liquidity = Number(asset.liquidity ?? 0);
  const poolAddress = String(asset.poolAddress || asset.poolId || "");
  const burned = Number(asset.burnedSupply ?? asset.supplyDistribution?.burnedSupply ?? 0);
  const royaltyStatus = String(asset.royaltyVerificationStatus || asset.royalty_status || "not_submitted");
  const lastRefresh = asset.lastRefreshAt || asset.liquidityEventAt || asset.createdAt;
  const syncHealthy = Boolean(price > 0 && (liquidity > 0 || asset.source === "open_audio" || asset.source === "audius_public"));

  return (
    <section className="rounded-2xl border border-edge bg-panel p-4 shadow-depth">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest font-black text-neon">Asset sync health</div>
          <p className="mt-1 text-xs leading-relaxed text-mute">Latest indexed price, pool, supply, burn, royalty, and refresh status.</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${syncHealthy ? "border-neon/25 bg-neon/10 text-neon" : "border-amber/25 bg-amber/10 text-amber"}`}>
          {syncHealthy ? "Synced" : "Indexing"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniSync label="Price" value={price > 0 ? formatUsd(price, 6) : "Not priced"} />
        <MiniSync label="Pool" value={poolAddress ? short(poolAddress) : liquidity > 0 ? "Indexing" : "Needs liquidity"} />
        <MiniSync label="Supply" value={asset.totalSupply ? fmtNum(Number(asset.totalSupply)) : "Pending"} />
        <MiniSync label="Burned" value={burned > 0 ? fmtNum(burned) : "0"} />
        <MiniSync label="Royalty" value={royaltyStatus.replace(/_/g, " ")} />
        <MiniSync label="Last refresh" value={toDateLabel(lastRefresh)} />
      </div>
    </section>
  );
}

export function InvestorTrustPanel({ asset }: { asset: Record<string, any> }) {
  const { formatUsd } = useUsdToDisplayRate();
  const isSongDaq = Boolean(asset.isSongDaqLocal || asset.source === "songdaq" || asset.songId);
  const artistVerified = Boolean(asset.audiusVerified || asset.songDaqVerified);
  const liquidity = Number(asset.liquidity ?? 0);
  const holder = Number(asset.holder ?? 0);
  const royaltyStatus = String(asset.royaltyVerificationStatus || asset.royalty_status || "not_submitted");
  const marketValueReliable = !isSongDaq || asset.isMarketValueReliable !== false;
  const auditItems = [
    { label: "Artist identity", value: artistVerified ? "Audius verified" : asset.artist_name ? "Artist linked" : "Needs review", ok: artistVerified || Boolean(asset.artist_name), icon: <BadgeCheck size={14} /> },
    { label: "Price source", value: asset.priceSource || asset.marketValueBasis || (isSongDaq ? "SONG·DAQ index" : "Open Audio index"), ok: Number(asset.price ?? 0) > 0, icon: <Flame size={14} /> },
    { label: "Public liquidity", value: liquidity > 0 ? formatUsd(liquidity, 2) : "Needs liquidity", ok: liquidity > 0, icon: <Droplets size={14} /> },
    { label: "Holders", value: holder > 0 ? fmtNum(holder) : "Indexing", ok: holder > 0 || isSongDaq, icon: <WalletCards size={14} /> },
    { label: "Royalty status", value: royaltyStatus.replace(/_/g, " "), ok: royaltyStatus.toLowerCase().includes("verified"), icon: <ShieldCheck size={14} /> },
    { label: "Market value", value: marketValueReliable ? "Public value visible" : "Hidden until liquid", ok: marketValueReliable, icon: <Database size={14} /> },
  ];

  return (
    <section className="rounded-2xl border border-edge bg-panel p-4 shadow-depth">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest font-black text-neon">Investor trust panel</div>
          <h3 className="mt-1 text-lg font-black text-ink">What this market is built on</h3>
          <p className="mt-1 text-xs leading-relaxed text-mute">
            SONG·DAQ separates music data, wallet data, app records, and router data so investors can see what is live, what is indexed, and what is still syncing.
          </p>
        </div>
        <AssetSourceBadges asset={asset} compact />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {auditItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-edge bg-panel2 p-3">
            <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest ${item.ok ? "text-neon" : "text-amber"}`}>
              {item.icon}
              {item.ok ? "Ready" : "Review"} · {item.label}
            </div>
            <div className="mt-1 break-words text-sm font-black text-ink">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs leading-relaxed text-mute">
        Audit trail: {asset.mintTx ? "mint tx recorded" : "mint indexed"} · {asset.liquidityTxSig ? "liquidity tx recorded" : "liquidity tx pending"} · {asset.createdAt ? `created ${toDateLabel(asset.createdAt)}` : "creation time pending"}.
      </div>
    </section>
  );
}

export function PostLaunchCoinManager({
  asset,
  localSongId,
  isOwner,
}: {
  asset: Record<string, any>;
  localSongId?: string | null;
  isOwner?: boolean;
}) {
  const { formatUsd } = useUsdToDisplayRate();
  const liquidity = Number(asset.liquidity ?? 0);
  const burned = Number(asset.burnedSupply ?? asset.supplyDistribution?.burnedSupply ?? 0);
  const splitsLocked = Boolean(asset.splitsLocked || asset.royaltyBacked || String(asset.royaltyVerificationStatus || "").includes("verified"));
  const royaltyStatus = String(asset.royaltyVerificationStatus || asset.royalty_status || "not_submitted");
  const addLiquidityHref = localSongId ? `/song/${localSongId}?liquidity=1#liquidity` : "";
  const splitsHref = `/splits?${new URLSearchParams({
    coinId: localSongId || String(asset.mint || ""),
    symbol: String(asset.ticker || ""),
    title: String(asset.audius_track_title || asset.name || ""),
    artist: String(asset.artist_name || ""),
  }).toString()}`;

  return (
    <section className="rounded-2xl border border-neon/20 bg-[linear-gradient(135deg,rgba(183,255,0,0.08),rgba(20,22,28,0.92))] p-4 shadow-[0_0_30px_rgba(183,255,0,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest font-black text-neon">Post-launch coin manager</div>
          <h3 className="mt-1 text-lg font-black text-ink">Price, liquidity, holders, burns, splits, royalty</h3>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${isOwner ? "border-neon/25 bg-neon/10 text-neon" : "border-edge bg-white/[0.04] text-mute"}`}>
          {isOwner ? "Creator controls" : "Read-only"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniSync label="Price" value={Number(asset.price ?? 0) > 0 ? formatUsd(Number(asset.price), 6) : "Not priced"} />
        <MiniSync label="Liquidity" value={liquidity > 0 ? formatUsd(liquidity, 2) : "Needs pool"} />
        <MiniSync label="Holders" value={asset.holder != null ? fmtNum(Number(asset.holder)) : "Indexing"} />
        <MiniSync label="Burned" value={burned > 0 ? fmtNum(burned) : "0"} />
        <MiniSync label="Splits" value={splitsLocked ? "Verified/locked" : "Not submitted"} />
        <MiniSync label="Royalty" value={royaltyStatus.replace(/_/g, " ")} />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {isOwner && addLiquidityHref ? (
          <Link href={addLiquidityHref} className="btn-primary h-10 px-3 text-center text-[11px] uppercase tracking-widest font-black">
            Add / Manage Liquidity
          </Link>
        ) : null}
        {isOwner ? (
          <Link href={splitsHref} className="btn h-10 px-3 text-center text-[11px] uppercase tracking-widest font-black">
            Manage Royalty Splits
          </Link>
        ) : null}
        {asset.mint ? (
          <a href={`https://solscan.io/token/${asset.mint}`} target="_blank" rel="noreferrer" className="btn h-10 px-3 text-center text-[11px] uppercase tracking-widest font-black">
            View Mint
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function MobileWalletHandoffTest() {
  const steps = [
    "Open SONG·DAQ on the phone browser.",
    "Tap Connect and choose Phantom, Solflare, or Backpack.",
    "Wallet app opens, unlocks, and returns a public key.",
    "SONG·DAQ shows SOL balance and keeps Audius linked.",
  ];
  return (
    <section className="rounded-2xl border border-violet/25 bg-violet/10 p-4">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-violet">
        <Smartphone size={14} /> Mobile wallet handoff test
      </div>
      <p className="mt-2 text-xs leading-relaxed text-mute">
        Use this checklist on iPhone Safari, iPhone Chrome, Android Chrome, and Samsung Internet after every wallet change.
      </p>
      <div className="mt-3 grid gap-2">
        {steps.map((step, index) => (
          <div key={step} className="flex gap-2 rounded-xl border border-edge bg-panel p-3 text-xs text-ink">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet/20 font-mono text-[10px] font-black text-violet">{index + 1}</span>
            <span className="leading-relaxed">{step}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-widest text-mute">
        <Clock3 size={12} /> Real device QA still required for app handoff.
      </div>
    </section>
  );
}

function MiniSync({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3">
      <div className="text-[10px] uppercase tracking-widest font-black text-mute">{label}</div>
      <div className="mt-1 min-w-0 break-words font-mono text-sm font-black text-ink">{value}</div>
    </div>
  );
}
