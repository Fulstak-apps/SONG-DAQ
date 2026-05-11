/**
 * Audius / Open Audio Protocol integration.
 *
 * Audius runs a network of public discovery nodes; we either use the host
 * pinned via AUDIUS_DISCOVERY_HOST or fetch the bootstrap registry at
 * https://api.audius.co and pick a healthy host. The Open Audio Protocol
 * exposes the same shape (Audius is its reference implementation) so this
 * client transparently works against either.
 *
 * Docs: https://docs.audius.org / https://docs.openaudio.org
 */

const APP_NAME = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
const PINNED = process.env.AUDIUS_DISCOVERY_HOST;
const FETCH_TIMEOUT_MS = 3_500;
const FALLBACK_HOSTS = [
  "https://api.audius.co",
  "https://discoveryprovider.audius.co",
  "https://discoveryprovider2.audius.co",
  "https://discoveryprovider3.audius.co",
];

let cachedHost: string | null = null;
let cachedAt = 0;
const HOST_TTL_MS = 60 * 60 * 1000;

async function discoverHost(): Promise<string> {
  if (PINNED) return PINNED;
  if (cachedHost && Date.now() - cachedAt < HOST_TTL_MS) return cachedHost;
  // The gateway is fast enough for UI requests and avoids a boot-time
  // discovery lookup before every first Audius call on cold Render starts.
  cachedHost = "https://api.audius.co";
  cachedAt = Date.now();
  return cachedHost;
}

async function audiusGet<T>(path: string): Promise<T> {
  const primary = await discoverHost();
  const hosts = Array.from(new Set([primary, ...(PINNED ? [] : FALLBACK_HOSTS)]));
  for (const host of hosts.slice(0, 4)) {
    const url = `${host}/v1${path}${path.includes("?") ? "&" : "?"}app_name=${APP_NAME}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
      if (res.ok && json?.data) return json.data;
      if (json?.error && /rate limit/i.test(json.error)) continue;
      if (!res.ok) continue;
    } catch {
      // Try next Audius gateway/provider.
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`audius unavailable for ${path}`);
}

export interface AudiusUser {
  id: string;
  handle: string;
  name: string;
  profile_picture?: { "150x150"?: string; "480x480"?: string };
  follower_count?: number;
}

export interface AudiusTrack {
  id: string;
  title: string;
  user: AudiusUser;
  artwork?: { "150x150"?: string; "480x480"?: string; "1000x1000"?: string };
  play_count?: number;
  favorite_count?: number;
  repost_count?: number;
  duration?: number;
  genre?: string;
  mood?: string;
  release_date?: string;
  permalink?: string;
}

export async function searchTracks(q: string, limit = 12): Promise<AudiusTrack[]> {
  if (!q?.trim()) return [];
  return audiusGet<AudiusTrack[]>(
    `/tracks/search?query=${encodeURIComponent(q)}&limit=${limit}`,
  );
}

export async function trendingTracks(limit = 24, genre?: string): Promise<AudiusTrack[]> {
  const params = new URLSearchParams({ time: "week", limit: String(limit) });
  if (genre) params.set("genre", genre);
  return audiusGet<AudiusTrack[]>(`/tracks/trending?${params.toString()}`);
}

export async function getTrack(trackId: string): Promise<AudiusTrack> {
  return audiusGet<AudiusTrack>(`/tracks/${trackId}`);
}

export async function streamUrl(trackId: string): Promise<string> {
  const host = await discoverHost();
  return `${host}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}`;
}

export function pickArtwork(t: AudiusTrack): string | undefined {
  return t.artwork?.["480x480"] || t.artwork?.["150x150"] || t.artwork?.["1000x1000"];
}

/** Fetch fresh metrics for a track (used by the price-update worker). */
export async function fetchMetrics(trackId: string): Promise<{
  streams: number;
  likes: number;
  reposts: number;
}> {
  const t = await getTrack(trackId);
  return {
    streams: t.play_count ?? 0,
    likes: t.favorite_count ?? 0,
    reposts: t.repost_count ?? 0,
  };
}
