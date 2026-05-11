import { isAudiusCompanyCoin, type AudiusCoin } from "@/lib/audiusCoins";

export type RiskLevel = "VERIFIED" | "LOWER_RISK" | "MEDIUM_RISK" | "HIGH_RISK" | "UNVERIFIED" | "RESTRICTED";

export interface CoinRisk {
  score: number;
  level: RiskLevel;
  label: string;
  warnings: string[];
  badges: string[];
  canTrade: boolean;
}

export function calculateCoinRisk(input: Partial<AudiusCoin> & Record<string, any>): CoinRisk {
  if (isAudiusCompanyCoin(input)) {
    return {
      score: 100,
      level: "VERIFIED",
      label: "Verified",
      warnings: [],
      badges: ["Official Audius company coin"],
      canTrade: true,
    };
  }

  const warnings: string[] = [];
  const badges: string[] = [];
  let score = 100;

  const verifiedArtist = Boolean(input.artist_handle || input.audius_track_id || input.audiusVerified);
  const royaltyVerified = Boolean(input.splitsLocked || input.royaltyStatus === "LOCKED" || input.royaltyStatus === "VERIFIED");
  const liquidity = Number(input.liquidity ?? input.reserveSol ?? input.liquidityPairAmount ?? 0);
  const liquidityLocked = Boolean(input.liquidityLocked || input.splitsLocked);
  const holders = Number(input.holder ?? input.holders ?? 0);
  const volume = Number(input.v24hUSD ?? input.volume24h ?? 0);
  const reportCount = Number(input.reportCount ?? 0);
  const change = Math.abs(Number(input.priceChange24hPercent ?? 0));

  if (!verifiedArtist) { score -= 22; warnings.push("Artist identity is not fully verified."); badges.push("Unverified artist"); }
  if (!input.audius_track_id && !input.audiusTrackId) { score -= 12; warnings.push("Song source is not linked to a verified catalog track."); badges.push("Song source pending"); }
  if (!royaltyVerified) { score -= 10; warnings.push("Royalty-backed transparency signal is not verified."); badges.push("Royalty unverified"); }
  if (liquidity <= 0) { score -= 35; warnings.push("No verified liquidity is available."); badges.push("No liquidity"); }
  else if (liquidity < 1) { score -= 18; warnings.push("Liquidity is low, so buys and sells may fail or move price sharply."); badges.push("Low liquidity"); }
  if (!liquidityLocked) { score -= 12; warnings.push("Liquidity lock is not verified."); badges.push("Liquidity not locked"); }
  if (holders > 0 && holders < 10) { score -= 8; warnings.push("Holder base is still concentrated."); badges.push("Concentrated holders"); }
  if (volume > 0 && holders > 0 && volume / Math.max(holders, 1) > 10_000) { score -= 10; warnings.push("Volume is high relative to holder count; wash trading review recommended."); badges.push("Wash-risk review"); }
  if (change > 80) { score -= 8; warnings.push("Large short-term price move detected."); badges.push("High volatility"); }
  if (reportCount > 0) { score -= Math.min(25, reportCount * 5); warnings.push(`${reportCount} report${reportCount === 1 ? "" : "s"} filed for review.`); badges.push("Reported"); }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  let level: RiskLevel = "LOWER_RISK";
  if (input.status === "RESTRICTED" || input.status === "DELISTED") level = "RESTRICTED";
  else if (!verifiedArtist || liquidity <= 0) level = "UNVERIFIED";
  else if (clamped < 45) level = "HIGH_RISK";
  else if (clamped < 75) level = "MEDIUM_RISK";

  return {
    score: clamped,
    level,
    label: level === "LOWER_RISK" ? "Lower Risk" : level.replace("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()),
    warnings,
    badges,
    canTrade: liquidity > 0 && level !== "RESTRICTED",
  };
}
