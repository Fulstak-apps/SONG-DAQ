export const CHART_RANGES = ["LIVE", "15S", "1MIN", "5MIN", "30MIN", "1H", "1D", "1W", "1MO", "1Y", "ALL"] as const;

export type ChartRange = typeof CHART_RANGES[number];

export const CHART_RANGE_LABELS: Record<ChartRange, string> = {
  LIVE: "Live",
  "15S": "15 Seconds",
  "1MIN": "1 Minute",
  "5MIN": "5 Minutes",
  "30MIN": "30 Minutes",
  "1H": "1 Hour",
  "1D": "1 Day",
  "1W": "1 Week",
  "1MO": "1 Month",
  "1Y": "1 Year",
  ALL: "All",
};

export const CHART_RANGE_MS: Record<ChartRange, number> = {
  LIVE: 15_000,
  "15S": 15_000,
  "1MIN": 60_000,
  "5MIN": 5 * 60_000,
  "30MIN": 30 * 60_000,
  "1H": 3_600_000,
  "1D": 86_400_000,
  "1W": 7 * 86_400_000,
  "1MO": 30 * 86_400_000,
  "1Y": 365 * 86_400_000,
  ALL: 10 * 365 * 86_400_000,
};

export function isFastRange(range: ChartRange) {
  return range === "LIVE" || range === "15S" || range === "1MIN";
}
