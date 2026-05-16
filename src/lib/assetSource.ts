export type AssetSourceKey =
  | "audius"
  | "open_audio"
  | "songdaq"
  | "jupiter"
  | "supabase"
  | "solana"
  | "demo";

export type AssetSourceMeta = {
  key: AssetSourceKey;
  label: string;
  shortLabel: string;
  tone: "neon" | "violet" | "blue" | "amber" | "muted";
  description: string;
};

export const ASSET_SOURCE_META: Record<AssetSourceKey, AssetSourceMeta> = {
  audius: {
    key: "audius",
    label: "Audius",
    shortLabel: "Audius",
    tone: "violet",
    description: "Artist, track, artwork, profile, and music stats from Audius/Open Audio.",
  },
  open_audio: {
    key: "open_audio",
    label: "Open Audio",
    shortLabel: "Open Audio",
    tone: "violet",
    description: "Public Open Audio artist coin data imported into SONG·DAQ.",
  },
  songdaq: {
    key: "songdaq",
    label: "SONG·DAQ",
    shortLabel: "SONG·DAQ",
    tone: "neon",
    description: "Song coin, launch, split, burn, and app-indexed market data created inside SONG·DAQ.",
  },
  jupiter: {
    key: "jupiter",
    label: "Jupiter",
    shortLabel: "Jupiter",
    tone: "blue",
    description: "Swap route, token price, and tradability data from Jupiter when available.",
  },
  supabase: {
    key: "supabase",
    label: "Supabase",
    shortLabel: "DB",
    tone: "amber",
    description: "SONG·DAQ database records for portfolios, launches, royalties, admin logs, and history.",
  },
  solana: {
    key: "solana",
    label: "Solana",
    shortLabel: "Solana",
    tone: "blue",
    description: "On-chain mint, wallet, pool, token account, and transaction data on Solana.",
  },
  demo: {
    key: "demo",
    label: "Demo Data",
    shortLabel: "Demo",
    tone: "muted",
    description: "Simulated or fallback data used only when live sources are unavailable or Paper Mode is active.",
  },
};

function addUnique(list: AssetSourceKey[], key: AssetSourceKey) {
  if (!list.includes(key)) list.push(key);
}

export function normalizeAssetSource(value: unknown): AssetSourceKey | null {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return null;
  if (raw === "song_daq" || raw === "songdaq" || raw === "song_daq_local") return "songdaq";
  if (raw === "audius_public" || raw === "open_audio" || raw === "openaudio") return "open_audio";
  if (raw === "audius") return "audius";
  if (raw === "jupiter" || raw === "jup") return "jupiter";
  if (raw === "supabase" || raw === "db" || raw === "database") return "supabase";
  if (raw === "solana" || raw === "chain" || raw === "onchain" || raw === "on_chain") return "solana";
  if (raw === "demo" || raw === "paper" || raw === "mock" || raw === "simulated") return "demo";
  return null;
}

export function inferAssetSources(asset: Record<string, any> | null | undefined): AssetSourceKey[] {
  const sources: AssetSourceKey[] = [];
  if (!asset) return sources;

  for (const raw of Array.isArray(asset.dataSources) ? asset.dataSources : []) {
    const normalized = normalizeAssetSource(raw);
    if (normalized) addUnique(sources, normalized);
  }

  const source = normalizeAssetSource(asset.source);
  if (source) addUnique(sources, source);

  if (asset.isSongDaqLocal || asset.songId || asset.mintAddress || asset.royaltyVerificationStatus) addUnique(sources, "songdaq");
  if (asset.isOpenAudioCoin || asset.source === "open_audio" || asset.source === "audius_public") addUnique(sources, "open_audio");
  if (asset.artist_handle || asset.audius_track_id || asset.audius_track_title || asset.audiusVerified) addUnique(sources, "audius");
  if (asset.mint || asset.poolAddress || asset.poolId || asset.liquidityTxSig || asset.mintTx) addUnique(sources, "solana");
  if (asset.priceSource === "jupiter" || asset.metadataSource === "jupiter" || asset.jupiterIndexed) addUnique(sources, "jupiter");
  if (asset.databaseStatus || asset.createdAt || asset.liquidityEventAt || asset.royaltyRequestId) addUnique(sources, "supabase");
  if (asset.isSimulated || asset.mode === "paper" || asset.fakeTokenAddress || asset.fakeLiquidityPoolAddress) addUnique(sources, "demo");

  if (!sources.length) addUnique(sources, "demo");
  return sources;
}

export function sourceLabel(key: AssetSourceKey) {
  return ASSET_SOURCE_META[key]?.label ?? key;
}
