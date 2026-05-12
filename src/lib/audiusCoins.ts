import { fetchJson } from "@/lib/fetchTimeout";

/**
 * Audius "Artist Tokens" — public Solana SPL tokens listed at
 * https://audius.co/clubs. Pulled from the discovery API.
 *
 *   GET https://api.audius.co/v1/coins?app_name=…
 *
 * Each coin includes price, market cap, holders, 24h volume, dynamic
 * bonding curve params, and the artist's Audius user id.
 */

const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
export const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";
let coinCache: { at: number; data: AudiusCoin[] } | null = null;
let hydratedCoinCache: { at: number; data: AudiusCoin[]; key: string } | null = null;
const COIN_CACHE_MS = 60_000;
const HYDRATED_COIN_CACHE_MS = 5 * 60_000;

export interface AudiusCoin {
  name: string;
  ticker: string;
  mint: string;
  decimals: number;
  owner_id: string;
  logo_uri?: string;
  description?: string;
  price?: number;
  marketCap?: number;
  liquidity?: number;
  totalSupply?: number;
  circulatingSupply?: number;
  holder?: number;
  v24h?: number;
  v24hUSD?: number;
  priceChange24hPercent?: number;
  uniqueWallet24h?: number;
  trade24h?: number;
  buy24h?: number;
  sell24h?: number;
  link_1?: string;
  link_2?: string;
  link_3?: string;
  link_4?: string;
  has_discord?: boolean;
  artist_handle?: string;
  artist_name?: string;
  artist_avatar?: string | null;
  /** ~32-point downsampled price series for inline sparklines on cards. */
  sparkline?: number[];
  /**
   * Audius Layer — the specific track this token is linked to.
   * Hydrated from the artist's top track when no explicit link exists.
   */
  audius_track_id?: string;
  audius_track_title?: string;
  audius_track_url?: string;
  audius_track_artwork?: string | null;
  audius_play_count?: number;
  /** SONG·DAQ-local song coin metadata. Present for coins created in this app before Audius/Jupiter index them. */
  isSongDaqLocal?: boolean;
  songId?: string;
  mintAddress?: string | null;
  createdAt?: string;
  status?: string;
  liquidityPairAmount?: number;
  liquidityTokenAmount?: number;
  liquidityLocked?: boolean;
  royaltyVerificationStatus?: string;
  royaltyBacked?: boolean;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickImage(input: any) {
  return firstString(
    input?.logo_uri,
    input?.logoUri,
    input?.logoURI,
    input?.image,
    input?.image_url,
    input?.artworkUrl,
    input?.artwork_url,
    input?.artist_avatar,
    input?.profilePicture?.["1000x1000"],
    input?.profilePicture?.["480x480"],
    input?.profilePicture?.["150x150"],
    input?.profile_picture?.["1000x1000"],
    input?.profile_picture?.["480x480"],
    input?.profile_picture?.["150x150"],
  );
}

function pickTrackArtwork(track: any) {
  return firstString(
    track?.artwork?.["1000x1000"],
    track?.artwork?.["480x480"],
    track?.artwork?.["150x150"],
    track?.artwork?.url,
    track?.artwork_url,
    track?.image,
  );
}

function normalizeCoin(c: AudiusCoin): AudiusCoin {
  const image = pickImage(c);
  return {
    ...c,
    logo_uri: image ?? c.logo_uri,
  };
}

export function isAudiusCompanyCoin(input: Partial<AudiusCoin> & Record<string, any> | null | undefined) {
  if (!input) return false;
  const ticker = String(input.ticker ?? "").toUpperCase();
  const name = String(input.name ?? "").toLowerCase();
  const mint = String(input.mint ?? "");
  return mint === AUDIO_MINT || ticker === "AUDIO" || name === "audius";
}

export async function listCoins(limit = 100): Promise<AudiusCoin[]> {
  // The Audius coins endpoint caps `limit` at 100. Clamp to be safe.
  const capped = Math.min(100, Math.max(1, limit));
  if (coinCache && Date.now() - coinCache.at < COIN_CACHE_MS && coinCache.data.length >= capped) {
    return coinCache.data.slice(0, capped);
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const json = await fetchJson<{ data: AudiusCoin[] }>(
        `https://api.audius.co/v1/coins?app_name=${APP}&limit=${capped}`,
        { next: { revalidate: 60 } },
        2_500,
      );
      const data = (json.data ?? []).map(normalizeCoin);
      if (data.length) coinCache = { at: Date.now(), data };
      return data;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  if (coinCache?.data.length) return coinCache.data.slice(0, capped);
  return [];
}

export async function getCoin(mint: string): Promise<AudiusCoin | null> {
  const all = await listCoins(100).catch(() => []);
  return all.find((c) => c.mint === mint || c.ticker?.toLowerCase() === mint.toLowerCase()) ?? null;
}

/**
 * Hydrate artist handles + top Audius track by resolving the user behind
 * owner_id. The top track becomes the "linked" track shown in the
 * PLAY SONG | BUY $TOKEN layout on the coin page and cards.
 */
export async function hydrateArtists(coins: AudiusCoin[]): Promise<AudiusCoin[]> {
  const key = coins.map((coin) => `${coin.mint}:${coin.owner_id}:${coin.logo_uri || ""}`).join("|");
  if (
    hydratedCoinCache &&
    hydratedCoinCache.key === key &&
    Date.now() - hydratedCoinCache.at < HYDRATED_COIN_CACHE_MS
  ) {
    return hydratedCoinCache.data;
  }

  const hosts = await (async () => {
    try {
      const j = await fetchJson<{ data: string[] }>("https://api.audius.co", { next: { revalidate: 3600 } }, 4_000);
      return j?.data?.length ? j.data : ["https://api.audius.co"];
    } catch { return ["https://api.audius.co"]; }
  })();
  const host = hosts[0];
  const out = await Promise.all(
    coins.map(async (c) => {
      const baseCoin = normalizeCoin(c);
      if (!baseCoin.owner_id) return baseCoin;
      try {
        // Fetch user profile + their top tracks in parallel.
        const [userResult, tracksResult] = await Promise.allSettled([
          fetchJson<any>(
            `${host}/v1/users/${encodeURIComponent(baseCoin.owner_id)}?app_name=${APP}`,
            { next: { revalidate: 600 } },
            4_500,
          ),
          fetchJson<any>(
            `${host}/v1/users/${encodeURIComponent(baseCoin.owner_id)}/tracks?app_name=${APP}&limit=5&sort=plays`,
            { next: { revalidate: 600 } },
            4_500,
          ),
        ]);
        if (userResult.status !== "fulfilled") return baseCoin;
        const uj = userResult.value;
        const u = uj?.data;
        if (!u) return baseCoin;

        // Pick the top track (highest play count).
        let topTrack: any = null;
        if (tracksResult.status === "fulfilled") {
          const tj = tracksResult.value;
          const tracks: any[] = tj?.data ?? [];
          topTrack = tracks.reduce((best: any, t: any) =>
            !best || (t.play_count ?? 0) > (best.play_count ?? 0) ? t : best,
          null);
        }

        const handle = u.handle as string | undefined;
        const artistAvatar = pickImage(u);
        const trackArtwork = pickTrackArtwork(topTrack);
        return {
          ...baseCoin,
          logo_uri: baseCoin.logo_uri || artistAvatar || trackArtwork || undefined,
          artist_handle: handle,
          artist_name: u.name,
          artist_avatar: artistAvatar,
          ...(topTrack && handle ? {
            audius_track_id: String(topTrack.id),
            audius_track_title: topTrack.title,
            audius_track_url: `https://audius.co/${handle}/${topTrack.permalink ?? topTrack.id}`,
            audius_track_artwork: trackArtwork,
            audius_play_count: topTrack.play_count ?? 0,
          } : {}),
        };
      } catch { return baseCoin; }
    }),
  );
  hydratedCoinCache = { at: Date.now(), data: out, key };
  return out;
}
