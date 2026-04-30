/**
 * Performance multiplier engine.
 *
 *   performance = w_streams * streamScore
 *               + w_engagement * engagementScore
 *               + w_volume * volumeScore
 *               + w_velocity * velocityScore
 *
 * Each component is a logarithmic score in roughly [0..3]. The combined
 * multiplier is clamped to [0.25, 8.0]. Fed into the bonding curve as
 * `performance` so the same curve geometry is shared by every song but
 * the price floor scales with real-world traction.
 */

export interface PerformanceInputs {
  streams: number;
  prevStreams?: number;
  likes: number;
  reposts: number;
  volume24h: number;          // SOL
  prevPerformance?: number;   // smoothing baseline
  hoursSinceLaunch?: number;
}

const WEIGHTS = { streams: 0.4, engagement: 0.25, volume: 0.25, velocity: 0.1 };

function logScore(x: number, scale: number): number {
  if (x <= 0) return 0;
  return Math.log10(1 + x / scale);
}

export function computePerformance(i: PerformanceInputs): number {
  const streamScore = logScore(i.streams, 1_000);                  // 1k streams ≈ 0.3
  const engagementScore = logScore(i.likes + 2 * i.reposts, 100);  // reposts weighted 2x
  const volumeScore = logScore(i.volume24h, 1);                    // 1 SOL volume ≈ 0.3
  const deltaStreams = Math.max(0, i.streams - (i.prevStreams ?? i.streams));
  const hours = Math.max(1, i.hoursSinceLaunch ?? 24);
  const velocityScore = logScore(deltaStreams / hours, 10);        // streams/hr

  const raw =
    WEIGHTS.streams * streamScore +
    WEIGHTS.engagement * engagementScore +
    WEIGHTS.volume * volumeScore +
    WEIGHTS.velocity * velocityScore;

  // Curve into multiplier space. base 1.0 + 2x raw score so a track with
  // ~10k streams + healthy engagement lands around 2-3x.
  const target = 1 + raw * 2;

  // EMA smoothing prevents jitter when metrics tick up.
  const prev = i.prevPerformance ?? target;
  const smoothed = prev * 0.7 + target * 0.3;

  return clamp(smoothed, 0.25, 8.0);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Format SOL amount human-readable. */
export function fmtSol(x: number, digits = 8): string {
  if (!isFinite(x)) return "—";
  if (Math.abs(x) >= 1000) return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(x) >= 1) return x.toFixed(Math.min(digits, 4));
  return x.toFixed(digits);
}

export function fmtNum(x: number): string {
  if (!isFinite(x)) return "—";
  const abs = Math.abs(x);
  if (abs >= 1e9) return (x / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (x / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (x / 1e3).toFixed(2) + "K";
  return x.toFixed(0);
}

export function fmtPct(x: number): string {
  if (!isFinite(x)) return "—";
  const sign = x > 0 ? "+" : "";
  return sign + x.toFixed(2) + "%";
}
