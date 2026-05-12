export type BadgeRarity = "Common" | "Rare" | "Epic" | "Legendary";

export type BadgeDefinition = {
  id: string;
  icon: string;
  name: string;
  rarity: BadgeRarity;
  unlockCondition: string;
};

export type UserBadge = BadgeDefinition & {
  unlocked: boolean;
  progress: number;
  dateEarned?: string;
  relatedAsset?: string;
  mode?: "paper" | "live";
};

export type HypeLevel = "Cold" | "Warming Up" | "Hot" | "On Fire" | "Viral Risk";

export type HypeScore = {
  assetId: string;
  ticker: string;
  title: string;
  artist: string;
  score: number;
  level: HypeLevel;
  reason: string;
  trend: "up" | "down" | "flat";
  breakdown: Array<{ label: string; value: number; detail: string }>;
};

export type SongIPO = {
  id: string;
  assetId: string;
  ticker: string;
  title: string;
  artist: string;
  launchPriceUsd: number;
  royaltyPoolPercentage: number;
  tokenSupply: number;
  earlyBackerLimit: number;
  status: "Upcoming" | "Live" | "Sold Out" | "Trading Open" | "Launch Complete";
  countdownLabel: string;
  first24hPerformance: number;
  earlyBackers: number;
  openingPriceUsd: number;
  currentPriceUsd: number;
};

export type Milestone = {
  id: string;
  assetId: string;
  name: string;
  progress: number;
  reward: string;
  dateUnlocked?: string;
  relatedBadge?: string;
};

export type UndervaluedSignal = {
  id: string;
  assetId: string;
  ticker: string;
  title: string;
  artist: string;
  signalName: string;
  explanation: string;
  confidence: number;
  dataPoints: string[];
  riskNote: string;
};

export type GamifiedAsset = {
  id?: string;
  mint?: string;
  mintAddress?: string | null;
  ticker?: string | null;
  symbol?: string | null;
  name?: string | null;
  title?: string | null;
  artist_name?: string | null;
  artistName?: string | null;
  artist_handle?: string | null;
  audius_track_title?: string | null;
  price?: number | null;
  marketCap?: number | null;
  v24hUSD?: number | null;
  volume24h?: number | null;
  priceChange24hPercent?: number | null;
  holder?: number | null;
  holders?: number | null;
  totalSupply?: number | null;
  supply?: number | null;
  royaltyPercentageCommitted?: number | null;
  royaltyBacked?: boolean | null;
};

export const badges: BadgeDefinition[] = [
  { id: "day-one-backer", icon: "spark", name: "Day One Backer", rarity: "Common", unlockCondition: "Bought during the first 24 hours." },
  { id: "first-100", icon: "100", name: "First 100", rarity: "Rare", unlockCondition: "Bought before the first 100 backers." },
  { id: "diamond-ears", icon: "diamond", name: "Diamond Ears", rarity: "Epic", unlockCondition: "Backed a song before major growth." },
  { id: "ar-demon", icon: "target", name: "A&R Demon", rarity: "Epic", unlockCondition: "Made 10 profitable early picks." },
  { id: "paper-millionaire", icon: "paper", name: "Paper Millionaire", rarity: "Legendary", unlockCondition: "Reached $1M in Paper Mode value." },
  { id: "underground-king", icon: "crown", name: "Underground King", rarity: "Epic", unlockCondition: "Backed 25 artists under 10K listeners." },
  { id: "hit-hunter", icon: "music", name: "Hit Hunter", rarity: "Rare", unlockCondition: "Backed a song before it hit 1M streams." },
  { id: "whale-watcher", icon: "eye", name: "Whale Watcher", rarity: "Rare", unlockCondition: "Spotted a large buy early." },
  { id: "exit-genius", icon: "exit", name: "Exit Genius", rarity: "Epic", unlockCondition: "Sold near a local top." },
  { id: "viral-prophet", icon: "flame", name: "Viral Prophet", rarity: "Legendary", unlockCondition: "Predicted a song before it moved up." },
  { id: "early-signal", icon: "signal", name: "Early Signal", rarity: "Common", unlockCondition: "Watched a song before its Hype Meter spiked." },
  { id: "ipo-hunter", icon: "ipo", name: "IPO Hunter", rarity: "Rare", unlockCondition: "Joined multiple Song IPO launches early." },
  { id: "milestone-maker", icon: "unlock", name: "Milestone Maker", rarity: "Rare", unlockCondition: "Held a song through a major milestone unlock." },
];

export const hypeScores: HypeScore[] = [];
export const userBadges: UserBadge[] = [];
export const songIPOs: SongIPO[] = [];
export const milestones: Milestone[] = [];
export const undervaluedSignals: UndervaluedSignal[] = [];
export const paperModeRewards = [
  { id: "paper-millionaire", name: "Paper Millionaire", targetUsd: 1_000_000 },
  { id: "paper-ipo-hunter", name: "Paper IPO Hunter", targetIpos: 3 },
];
export const songMetrics = [
  "trading volume",
  "watchlist growth",
  "stream growth",
  "video growth",
  "new investors",
  "price momentum",
];
export const artistMetrics = [
  "Audius follower growth",
  "song releases",
  "artist coin performance",
  "watchlist activity",
  "social proof",
];

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function assetId(asset?: GamifiedAsset | null) {
  return String(asset?.mint || asset?.mintAddress || asset?.id || asset?.ticker || asset?.symbol || "song-daq-demo");
}

export function assetTicker(asset?: GamifiedAsset | null) {
  return String(asset?.ticker || asset?.symbol || "SONG").replace(/^\$/, "").toUpperCase();
}

export function assetTitle(asset?: GamifiedAsset | null) {
  return String(asset?.audius_track_title || asset?.title || asset?.name || `$${assetTicker(asset)}`);
}

export function assetArtist(asset?: GamifiedAsset | null) {
  return String(asset?.artist_name || asset?.artistName || asset?.artist_handle || "Artist");
}

function seed(asset?: GamifiedAsset | null) {
  return hashText(`${assetId(asset)}:${assetTicker(asset)}:${assetTitle(asset)}`);
}

export function getHypeScore(asset?: GamifiedAsset | null): HypeScore {
  const s = seed(asset);
  const volume = Number(asset?.v24hUSD ?? asset?.volume24h ?? 0);
  const change = Number(asset?.priceChange24hPercent ?? 0);
  const holders = Number(asset?.holder ?? asset?.holders ?? 0);
  const marketCap = Number(asset?.marketCap ?? 0);
  const watchlistGrowth = 8 + (s % 49);
  const streamGrowth = 5 + ((s >> 2) % 31);
  const socialMentions = 6 + ((s >> 4) % 38);
  const investorGrowth = holders > 0 ? Math.min(34, holders / 6) : (s % 18);
  const volumeScore = volume > 0 ? Math.min(32, Math.log10(volume + 10) * 8) : (s % 13);
  const priceScore = Math.max(-10, Math.min(20, change * 2));
  const undercapBoost = marketCap > 0 && volume > marketCap * 0.02 ? 9 : 0;
  const score = clamp(18 + volumeScore + priceScore + investorGrowth + watchlistGrowth * 0.22 + streamGrowth * 0.18 + socialMentions * 0.16 + undercapBoost);
  const level: HypeLevel = score >= 90 ? "Viral Risk" : score >= 75 ? "On Fire" : score >= 58 ? "Hot" : score >= 35 ? "Warming Up" : "Cold";
  const trend = change > 1 || score >= 58 ? "up" : change < -2 ? "down" : "flat";
  const reason = score >= 75
    ? `Watchlists up ${watchlistGrowth}%, volume up ${Math.max(12, Math.round(volumeScore * 2))}%, streams up ${streamGrowth}%.`
    : score >= 45
      ? `Early activity is building: watchlists up ${watchlistGrowth}% and social mentions up ${socialMentions}%.`
      : `Quiet market, but ${watchlistGrowth}% watchlist growth keeps it on the radar.`;

  return {
    assetId: assetId(asset),
    ticker: assetTicker(asset),
    title: assetTitle(asset),
    artist: assetArtist(asset),
    score,
    level,
    reason,
    trend,
    breakdown: [
      { label: "Trading volume", value: clamp(volumeScore * 3), detail: volume > 0 ? `$${Math.round(volume).toLocaleString()} recent volume` : "Demo volume estimate" },
      { label: "Watchlist growth", value: clamp(watchlistGrowth), detail: `${watchlistGrowth}% watchlist growth` },
      { label: "Stream growth", value: clamp(streamGrowth * 2), detail: `${streamGrowth}% stream growth estimate` },
      { label: "New investors", value: clamp(investorGrowth * 3), detail: `${Math.round(investorGrowth)} investor momentum score` },
      { label: "Price momentum", value: clamp(50 + change * 3), detail: `${change >= 0 ? "+" : ""}${change.toFixed(2)}% recent move` },
    ],
  };
}

export function getUserBadges(options: { mode?: "paper" | "live"; asset?: GamifiedAsset | null; portfolioValueUsd?: number } = {}): UserBadge[] {
  const s = seed(options.asset) + Math.round(options.portfolioValueUsd || 0);
  return badges.map((badge, index) => {
    const rawProgress = badge.id === "paper-millionaire" && options.mode === "paper"
      ? Math.min(100, ((options.portfolioValueUsd || 0) / 1_000_000) * 100)
      : (s + index * 17) % 115;
    const unlocked = rawProgress >= 100 || index < 2;
    return {
      ...badge,
      progress: unlocked ? 100 : clamp(rawProgress),
      unlocked,
      dateEarned: unlocked ? new Date(Date.now() - (index + 1) * 86400000).toISOString() : undefined,
      relatedAsset: assetTitle(options.asset),
      mode: options.mode || "live",
    };
  });
}

export function getSongIPO(asset?: GamifiedAsset | null): SongIPO {
  const s = seed(asset);
  const price = Number(asset?.price || 0);
  const launchPriceUsd = price > 0 ? price : 0.00001 * (1 + (s % 25));
  const currentPriceUsd = price > 0 ? price : launchPriceUsd * (1 + ((s % 22) - 6) / 100);
  const statuses: SongIPO["status"][] = ["Upcoming", "Live", "Trading Open", "Launch Complete"];
  return {
    id: `ipo-${assetId(asset)}`,
    assetId: assetId(asset),
    ticker: assetTicker(asset),
    title: assetTitle(asset),
    artist: assetArtist(asset),
    launchPriceUsd,
    royaltyPoolPercentage: Number(asset?.royaltyPercentageCommitted ?? (10 + (s % 16))),
    tokenSupply: Number(asset?.totalSupply ?? asset?.supply ?? 1_000_000_000),
    earlyBackerLimit: 100,
    status: statuses[s % statuses.length],
    countdownLabel: s % 4 === 0 ? "Starts soon" : s % 4 === 1 ? "Live now" : "Trading open",
    first24hPerformance: ((s % 48) - 8) / 100,
    earlyBackers: 24 + (s % 176),
    openingPriceUsd: launchPriceUsd,
    currentPriceUsd,
  };
}

export function getSongIPOs(assets: GamifiedAsset[] = [], limit = 4) {
  return (assets.length ? assets : [{ ticker: "IPO", title: "Demo Song IPO", artist_name: "SONG·DAQ" }])
    .slice(0, Math.max(limit, 1))
    .map(getSongIPO);
}

export function getMilestones(asset?: GamifiedAsset | null): Milestone[] {
  const s = seed(asset);
  const names = [
    ["10K streams", "Hit Hunter progress"],
    ["100K streams", "Early backers earned momentum credit"],
    ["First 100 investors", "First 100 badge eligibility"],
    ["First $1,000 volume", "Milestone Maker progress"],
    ["First royalty payout", "Royalty signal unlocked"],
    ["First Hype Meter spike", "Early Signal progress"],
  ];
  return names.map(([name, reward], index) => {
    const progress = clamp(((s >> index) % 115));
    const unlocked = progress >= 100 || index === 0;
    return {
      id: `${assetId(asset)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      assetId: assetId(asset),
      name,
      progress: unlocked ? 100 : progress,
      reward,
      dateUnlocked: unlocked ? new Date(Date.now() - (index + 2) * 86400000).toISOString() : undefined,
      relatedBadge: index === 1 ? "Hit Hunter" : index === 2 ? "First 100" : index === 5 ? "Early Signal" : undefined,
    };
  });
}

export function getUndervaluedSignal(asset?: GamifiedAsset | null): UndervaluedSignal {
  const s = seed(asset);
  const hype = getHypeScore(asset);
  const marketCap = Number(asset?.marketCap ?? 0);
  const volume = Number(asset?.v24hUSD ?? asset?.volume24h ?? 0);
  const holders = Number(asset?.holder ?? asset?.holders ?? 0);
  const confidence = clamp(42 + hype.score * 0.38 + (volume > 0 && marketCap > 0 && volume < marketCap * 0.002 ? 12 : 0) + (holders < 80 ? 8 : 0));
  const streamGrowth = 18 + (s % 34);
  const tiktokGrowth = 12 + ((s >> 3) % 40);
  return {
    id: `signal-${assetId(asset)}`,
    assetId: assetId(asset),
    ticker: assetTicker(asset),
    title: assetTitle(asset),
    artist: assetArtist(asset),
    signalName: hype.score >= 70 ? "Hype rising faster than price" : "Potentially undervalued",
    explanation: `${assetTitle(asset)} has ${streamGrowth}% stream growth and ${tiktokGrowth}% short-form growth while investor activity is still early.`,
    confidence,
    dataPoints: [
      `${streamGrowth}% stream growth estimate`,
      `${tiktokGrowth}% TikTok usage growth estimate`,
      `${holders || 46} investors / holders indexed`,
      volume > 0 ? `$${Math.round(volume).toLocaleString()} recent volume` : "Low reported trading volume",
    ],
    riskNote: "Signals are discovery tools, not financial advice.",
  };
}

export function getUndervaluedSignals(assets: GamifiedAsset[] = [], limit = 4) {
  const source = assets.length ? assets : [{ ticker: "FIND", title: "Demo Signal", artist_name: "SONG·DAQ" }];
  return source
    .map(getUndervaluedSignal)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}
