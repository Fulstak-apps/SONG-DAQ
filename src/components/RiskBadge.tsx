"use client";
import { calculateCoinRisk } from "@/lib/risk/calculateCoinRisk";
import { isAudiusCompanyCoin, type AudiusCoin } from "@/lib/audiusCoins";

export function RiskBadge({ coin, compact = false }: { coin: Partial<AudiusCoin> & Record<string, any>; compact?: boolean }) {
  const risk = calculateCoinRisk(coin);
  const cls =
    risk.level === "VERIFIED" ? "border-cyan/25 bg-cyan/10 text-cyan"
    : risk.level === "LOWER_RISK" ? "border-neon/25 bg-neon/10 text-neon"
    : risk.level === "MEDIUM_RISK" ? "border-amber/25 bg-amber/10 text-amber"
    : risk.level === "HIGH_RISK" || risk.level === "RESTRICTED" ? "border-red/25 bg-red/10 text-red"
    : "border-violet/25 bg-violet/10 text-violet";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-black uppercase tracking-widest ${cls}`} title={risk.warnings.join(" ") || "Risk checks passed"}>
      {compact ? risk.label.replace(" Risk", "") : risk.label}
    </span>
  );
}

export function MarketSafetyPanel({ coin }: { coin: Partial<AudiusCoin> & Record<string, any> }) {
  const risk = calculateCoinRisk(coin);
  const isCompanyCoin = isAudiusCompanyCoin(coin);
  const artistVerified = Boolean(coin.audiusVerified || coin.songDaqVerified || coin.artistWallet?.audiusVerified);
  const rows = [
    ["Asset type", isCompanyCoin ? "Official Audius company coin" : "Artist / song market asset"],
    ["Artist verification", isCompanyCoin ? "Official" : artistVerified ? "Verified via Audius" : coin.artist_handle ? "Audius linked" : "Identity review"],
    ["Song verification", isCompanyCoin ? "Not applicable" : coin.audius_track_id || coin.audiusTrackId ? "Catalog linked" : "Pending"],
    ["Royalty signal", isCompanyCoin ? "Not applicable" : coin.splitsLocked || coin.royaltyStatus === "LOCKED" ? "Locked/verified" : "Not verified yet"],
    ["Liquidity status", isCompanyCoin ? "Official market asset" : Number(coin.liquidity ?? coin.reserveSol ?? coin.liquidityPairAmount ?? 0) > 0 ? "Active" : "No liquidity"],
    ["Liquidity lock", isCompanyCoin ? "Managed by Audius" : coin.liquidityLocked ? "Locked" : "Not verified"],
    ["Reports", String(coin.reportCount ?? 0)],
  ];
  return (
    <section className="panel p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-edge pb-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest font-black text-mute">Market Safety</div>
          <div className="mt-1 text-2xl font-black text-ink">{risk.score}/100</div>
        </div>
        <RiskBadge coin={coin} />
      </div>
      <div className="grid gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-mute uppercase tracking-widest font-bold text-[11px]">{k}</span>
            <span className="text-ink font-mono text-right">{v}</span>
          </div>
        ))}
      </div>
      {!!risk.warnings.length && (
        <div className="rounded-xl border border-amber/20 bg-amber/8 p-3 text-xs text-amber/90 leading-relaxed">
          {risk.warnings[0]}
        </div>
      )}
    </section>
  );
}
