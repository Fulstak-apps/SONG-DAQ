/**
 * Audius "Artist Coins" — public Solana SPL tokens listed at
 * https://audius.co/clubs. Pulled from the discovery API.
 *
 *   GET https://api.audius.co/v1/coins?app_name=…
 *
 * Each coin includes price, market cap, holders, 24h volume, dynamic
 * bonding curve params, and the artist's Audius user id.
 */

const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";

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
}

export async function listCoins(limit = 100): Promise<AudiusCoin[]> {
  // The Audius coins endpoint caps `limit` at 100. Clamp to be safe.
  const capped = Math.min(100, Math.max(1, limit));
  const res = await fetch(`https://api.audius.co/v1/coins?app_name=${APP}&limit=${capped}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`audius coins ${res.status}`);
  const json = (await res.json()) as { data: AudiusCoin[] };
  return json.data ?? [];
}

export async function getCoin(mint: string): Promise<AudiusCoin | null> {
  const all = await listCoins(100);
  return all.find((c) => c.mint === mint || c.ticker?.toLowerCase() === mint.toLowerCase()) ?? null;
}

/**
 * Hydrate artist handles + top Audius track by resolving the user behind
 * owner_id. The top track becomes the "linked" track shown in the
 * PLAY SONG | BUY $TOKEN layout on the coin page and cards.
 */
export async function hydrateArtists(coins: AudiusCoin[]): Promise<AudiusCoin[]> {
  const hosts = await (async () => {
    try {
      const r = await fetch("https://api.audius.co", { next: { revalidate: 3600 } });
      const j = (await r.json()) as { data: string[] };
      return j?.data?.length ? j.data : ["https://api.audius.co"];
    } catch { return ["https://api.audius.co"]; }
  })();
  const host = hosts[0];
  const out = await Promise.all(
    coins.map(async (c) => {
      if (!c.owner_id) return c;
      try {
        // Fetch user profile + their top tracks in parallel.
        const [ru, rt] = await Promise.all([
          fetch(`${host}/v1/users/${encodeURIComponent(c.owner_id)}?app_name=${APP}`, {
            next: { revalidate: 600 },
          }),
          fetch(`${host}/v1/users/${encodeURIComponent(c.owner_id)}/tracks?app_name=${APP}&limit=5&sort=plays`, {
            next: { revalidate: 600 },
          }),
        ]);
        if (!ru.ok) return c;
        const uj = await ru.json();
        const u = uj?.data;
        if (!u) return c;

        // Pick the top track (highest play count).
        let topTrack: any = null;
        if (rt.ok) {
          const tj = await rt.json();
          const tracks: any[] = tj?.data ?? [];
          topTrack = tracks.reduce((best: any, t: any) =>
            !best || (t.play_count ?? 0) > (best.play_count ?? 0) ? t : best,
          null);
        }

        const handle = u.handle as string | undefined;
        return {
          ...c,
          artist_handle: handle,
          artist_name: u.name,
          artist_avatar:
            u.profilePicture?.["480x480"] ||
            u.profilePicture?.["150x150"] ||
            null,
          ...(topTrack && handle ? {
            audius_track_id: String(topTrack.id),
            audius_track_title: topTrack.title,
            audius_track_url: `https://audius.co/${handle}/${topTrack.permalink ?? topTrack.id}`,
            audius_track_artwork:
              topTrack.artwork?.["480x480"] ??
              topTrack.artwork?.["150x150"] ??
              null,
            audius_play_count: topTrack.play_count ?? 0,
          } : {}),
        };
      } catch { return c; }
    }),
  );
  return out;
}
