import { prisma } from "@/lib/db";
import { fetchJson } from "@/lib/fetchTimeout";
import { pickAudiusArtwork } from "@/lib/audiusArtwork";

const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
const AUDIUS_API = process.env.AUDIUS_DISCOVERY_HOST || "https://api.audius.co";
const CACHE_MS = 6 * 60 * 60_000;
const HIGH_CONFIDENCE = 0.86;

type SourceType = "auto_detected" | "artist_provided" | "admin_verified";

export type ArtistIntelProfile = {
  platform: string;
  url: string;
  handle?: string | null;
  displayName?: string | null;
  imageUrl?: string | null;
  bio?: string | null;
  followerCount?: number | null;
  popularityScore?: number | null;
  verified?: boolean | null;
  sourceType: SourceType;
  confidence: number;
  lastSyncedAt?: string | null;
  metrics?: Record<string, unknown> | null;
};

export type SongIntelLink = {
  platform: string;
  url: string;
  title?: string | null;
  imageUrl?: string | null;
  channelName?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  publishedAt?: string | null;
  sourceType: SourceType;
  confidence: number;
  lastSyncedAt?: string | null;
  metrics?: Record<string, unknown> | null;
};

export type ArtistIntelInput = {
  mint?: string | null;
  artistName?: string | null;
  handle?: string | null;
  songTitle?: string | null;
  trackId?: string | null;
};

export type ArtistIntelResult = {
  ok: true;
  artistKey: string | null;
  songKey: string | null;
  artistName: string | null;
  songTitle: string | null;
  profiles: ArtistIntelProfile[];
  songLinks: SongIntelLink[];
  tracks: Array<{
    id: string;
    title: string;
    url: string;
    imageUrl?: string | null;
    playCount?: number | null;
    favoriteCount?: number | null;
    repostCount?: number | null;
  }>;
  updatedAt: string;
  note: string;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function key(value: unknown) {
  return normalize(value).replace(/\s+/g, "-").slice(0, 120);
}

function textScore(expected: unknown, candidate: unknown) {
  const a = normalize(expected);
  const b = normalize(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.88;
  const aw = new Set(a.split(" ").filter(Boolean));
  const bw = new Set(b.split(" ").filter(Boolean));
  if (!aw.size || !bw.size) return 0;
  let hit = 0;
  aw.forEach((word) => { if (bw.has(word)) hit += 1; });
  return hit / Math.max(aw.size, bw.size);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

function parseMetrics(value?: string | null) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function spotifyUrl(id: string, type: "artist" | "track") {
  return `https://open.spotify.com/${type}/${id}`;
}

async function resolveLocalCoin(input: ArtistIntelInput) {
  if (!input.mint) return null;
  try {
    return await prisma.songToken.findFirst({
      where: {
        OR: [
          { mintAddress: input.mint },
          { fakeTokenAddress: input.mint },
          { symbol: input.mint },
        ],
      },
      select: {
        id: true,
        title: true,
        artistName: true,
        artworkUrl: true,
        audiusTrackId: true,
        artistWallet: {
          select: {
            audiusHandle: true,
            audiusName: true,
            audiusAvatar: true,
            audiusVerified: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

async function fetchAudiusProfile(handle?: string | null): Promise<ArtistIntelProfile | null> {
  if (!handle) return null;
  const cleanHandle = handle.replace(/^@/, "").trim();
  if (!cleanHandle) return null;
  try {
    const j = await fetchJson<{ data?: any }>(
      `${AUDIUS_API}/v1/users/handle/${encodeURIComponent(cleanHandle)}?app_name=${APP}`,
      { next: { revalidate: 900 } },
      4_500,
    );
    const u = j?.data;
    if (!u) return null;
    const imageUrl = pickAudiusArtwork({ artwork: u.profile_picture, profile_picture: u.profile_picture }) ||
      u.profile_picture?.["480x480"] ||
      u.profilePicture?.["480x480"] ||
      null;
    return {
      platform: "audius",
      url: `https://audius.co/${u.handle || cleanHandle}`,
      handle: u.handle || cleanHandle,
      displayName: u.name || u.handle || cleanHandle,
      imageUrl,
      bio: u.bio || null,
      followerCount: Number(u.follower_count ?? u.followerCount ?? 0) || null,
      verified: Boolean(u.is_verified ?? u.verified),
      sourceType: "auto_detected",
      confidence: 1,
      lastSyncedAt: new Date().toISOString(),
      metrics: {
        followingCount: Number(u.followee_count ?? u.followingCount ?? 0) || null,
        trackCount: Number(u.track_count ?? u.trackCount ?? 0) || null,
        audioBalance: Number(u.total_audio_balance ?? 0) || null,
      },
    };
  } catch {
    return null;
  }
}

async function fetchAudiusTracks(handle?: string | null, trackId?: string | null) {
  const cleanHandle = handle?.replace(/^@/, "").trim();
  if (!cleanHandle && !trackId) return [];
  try {
    if (trackId) {
      const j = await fetchJson<{ data?: any }>(
        `${AUDIUS_API}/v1/tracks/${encodeURIComponent(trackId)}?app_name=${APP}`,
        { next: { revalidate: 900 } },
        4_500,
      );
      return j?.data ? [j.data] : [];
    }
    const user = await fetchJson<{ data?: any }>(
      `${AUDIUS_API}/v1/users/handle/${encodeURIComponent(cleanHandle!)}?app_name=${APP}`,
      { next: { revalidate: 900 } },
      4_500,
    ).catch(() => null);
    const userId = user?.data?.id;
    if (!userId) return [];
    const tracks = await fetchJson<{ data?: any[] }>(
      `${AUDIUS_API}/v1/users/${encodeURIComponent(userId)}/tracks?app_name=${APP}&limit=8`,
      { next: { revalidate: 900 } },
      4_500,
    ).catch(() => null);
    return tracks?.data ?? [];
  } catch {
    return [];
  }
}

let spotifyTokenCache: { token: string; exp: number } | null = null;
async function spotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (spotifyTokenCache && spotifyTokenCache.exp > Date.now() + 60_000) return spotifyTokenCache.token;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.access_token) return null;
    spotifyTokenCache = { token: j.access_token, exp: Date.now() + Number(j.expires_in ?? 3600) * 1000 };
    return spotifyTokenCache.token;
  } catch {
    return null;
  }
}

async function fetchSpotifyProfile(artistName?: string | null): Promise<ArtistIntelProfile | null> {
  if (!artistName) return null;
  const token = await spotifyToken();
  if (!token) return null;
  try {
    const qs = new URLSearchParams({ q: `artist:${artistName}`, type: "artist", limit: "5" });
    const j = await fetchJson<any>(
      `https://api.spotify.com/v1/search?${qs.toString()}`,
      { headers: { authorization: `Bearer ${token}` }, next: { revalidate: 86_400 } },
      4_500,
    );
    const items = j?.artists?.items ?? [];
    const best = items
      .map((artist: any) => ({ artist, score: textScore(artistName, artist?.name) }))
      .sort((a: any, b: any) => b.score - a.score)[0];
    if (!best || best.score < HIGH_CONFIDENCE) return null;
    return {
      platform: "spotify",
      url: best.artist?.external_urls?.spotify || spotifyUrl(best.artist.id, "artist"),
      displayName: best.artist?.name ?? artistName,
      imageUrl: best.artist?.images?.[0]?.url ?? null,
      followerCount: Number(best.artist?.followers?.total ?? 0) || null,
      popularityScore: Number(best.artist?.popularity ?? 0) || null,
      sourceType: "auto_detected",
      confidence: best.score,
      lastSyncedAt: new Date().toISOString(),
      metrics: { genres: best.artist?.genres ?? [] },
    };
  } catch {
    return null;
  }
}

async function fetchSpotifyTrack(artistName?: string | null, songTitle?: string | null): Promise<SongIntelLink | null> {
  if (!artistName || !songTitle) return null;
  const token = await spotifyToken();
  if (!token) return null;
  try {
    const qs = new URLSearchParams({ q: `track:${songTitle} artist:${artistName}`, type: "track", limit: "5" });
    const j = await fetchJson<any>(
      `https://api.spotify.com/v1/search?${qs.toString()}`,
      { headers: { authorization: `Bearer ${token}` }, next: { revalidate: 86_400 } },
      4_500,
    );
    const items = j?.tracks?.items ?? [];
    const best = items
      .map((track: any) => {
        const artistScore = Math.max(...(track?.artists ?? []).map((a: any) => textScore(artistName, a?.name)), 0);
        const titleScore = textScore(songTitle, track?.name);
        return { track, score: (artistScore * 0.45) + (titleScore * 0.55) };
      })
      .sort((a: any, b: any) => b.score - a.score)[0];
    if (!best || best.score < HIGH_CONFIDENCE) return null;
    return {
      platform: "spotify",
      url: best.track?.external_urls?.spotify || spotifyUrl(best.track.id, "track"),
      title: best.track?.name ?? songTitle,
      imageUrl: best.track?.album?.images?.[0]?.url ?? null,
      channelName: (best.track?.artists ?? []).map((a: any) => a.name).join(", ") || artistName,
      sourceType: "auto_detected",
      confidence: best.score,
      lastSyncedAt: new Date().toISOString(),
      metrics: {
        album: best.track?.album?.name ?? null,
        popularity: best.track?.popularity ?? null,
        isrc: best.track?.external_ids?.isrc ?? null,
      },
    };
  } catch {
    return null;
  }
}

function youtubeThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

async function fetchYouTubeMatches(artistName?: string | null, songTitle?: string | null): Promise<SongIntelLink[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !artistName || !songTitle) return [];
  try {
    const query = `${artistName} ${songTitle} official audio`;
    const qs = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "5",
      q: query,
      key,
    });
    const search = await fetchJson<any>(
      `https://www.googleapis.com/youtube/v3/search?${qs.toString()}`,
      { next: { revalidate: 21_600 } },
      4_500,
    );
    const ids = (search?.items ?? []).map((item: any) => item?.id?.videoId).filter(Boolean);
    if (!ids.length) return [];
    const detailQs = new URLSearchParams({
      part: "snippet,statistics",
      id: ids.join(","),
      key,
    });
    const details = await fetchJson<any>(
      `https://www.googleapis.com/youtube/v3/videos?${detailQs.toString()}`,
      { next: { revalidate: 21_600 } },
      4_500,
    );
    return (details?.items ?? [])
      .map((video: any) => {
        const title = video?.snippet?.title ?? "";
        const channel = video?.snippet?.channelTitle ?? "";
        const titleScore = textScore(`${artistName} ${songTitle}`, title);
        const artistScore = Math.max(textScore(artistName, channel), textScore(artistName, title));
        const lowSignal = /\b(cover|remix|slowed|reverb|nightcore|karaoke|reaction)\b/i.test(title);
        const confidence = Math.max(0, (titleScore * 0.7) + (artistScore * 0.3) - (lowSignal ? 0.2 : 0));
        return {
          platform: "youtube",
          url: `https://www.youtube.com/watch?v=${video.id}`,
          title,
          imageUrl: video?.snippet?.thumbnails?.high?.url ?? youtubeThumb(video.id),
          channelName: channel,
          viewCount: Number(video?.statistics?.viewCount ?? 0) || null,
          likeCount: Number(video?.statistics?.likeCount ?? 0) || null,
          commentCount: Number(video?.statistics?.commentCount ?? 0) || null,
          publishedAt: video?.snippet?.publishedAt ?? null,
          sourceType: "auto_detected" as SourceType,
          confidence,
          lastSyncedAt: new Date().toISOString(),
          metrics: null,
        };
      })
      .filter((video: SongIntelLink) => video.confidence >= HIGH_CONFIDENCE)
      .sort((a: SongIntelLink, b: SongIntelLink) => b.confidence - a.confidence)
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function manualProfiles(artistKey: string | null) {
  if (!artistKey) return [];
  try {
    const rows = await prisma.artistExternalProfile.findMany({
      where: {
        artistKey,
        status: "active",
        sourceType: { in: ["artist_provided", "admin_verified"] },
      },
      orderBy: [{ sourceType: "desc" }, { confidence: "desc" }],
      take: 20,
    });
    return rows.map((row) => ({
      platform: row.platform,
      url: row.url,
      handle: row.handle,
      displayName: row.displayName,
      imageUrl: row.imageUrl,
      bio: row.bio,
      followerCount: row.followerCount,
      popularityScore: row.popularityScore,
      sourceType: row.sourceType as SourceType,
      confidence: row.confidence,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      metrics: parseMetrics(row.metricsJson),
    }));
  } catch {
    return [];
  }
}

async function manualSongLinks(songKey: string | null, artistKey: string | null) {
  if (!songKey && !artistKey) return [];
  try {
    const rows = await prisma.songExternalLink.findMany({
      where: {
        status: "active",
        sourceType: { in: ["artist_provided", "admin_verified"] },
        OR: [
          ...(songKey ? [{ songKey }] : []),
          ...(artistKey ? [{ artistKey }] : []),
        ],
      },
      orderBy: [{ sourceType: "desc" }, { confidence: "desc" }],
      take: 20,
    });
    return rows.map((row) => ({
      platform: row.platform,
      url: row.url,
      title: row.title,
      imageUrl: row.imageUrl,
      channelName: row.channelName,
      viewCount: row.viewCount,
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      sourceType: row.sourceType as SourceType,
      confidence: row.confidence,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      metrics: parseMetrics(row.metricsJson),
    }));
  } catch {
    return [];
  }
}

async function persistProfile(artistKey: string | null, profile: ArtistIntelProfile, artistName?: string | null) {
  if (!artistKey || !profile.url) return;
  try {
    await prisma.artistExternalProfile.upsert({
      where: { artistKey_platform_url: { artistKey, platform: profile.platform, url: profile.url } },
      create: {
        artistKey,
        artistName,
        platform: profile.platform,
        url: profile.url,
        handle: profile.handle,
        displayName: profile.displayName,
        imageUrl: profile.imageUrl,
        bio: profile.bio,
        followerCount: profile.followerCount,
        popularityScore: profile.popularityScore,
        metricsJson: safeJson(profile.metrics),
        confidence: profile.confidence,
        sourceType: profile.sourceType,
        status: "active",
        lastSyncedAt: new Date(),
      },
      update: {
        artistName,
        handle: profile.handle,
        displayName: profile.displayName,
        imageUrl: profile.imageUrl,
        bio: profile.bio,
        followerCount: profile.followerCount,
        popularityScore: profile.popularityScore,
        metricsJson: safeJson(profile.metrics),
        confidence: profile.confidence,
        status: "active",
        lastSyncedAt: new Date(),
      },
    });
  } catch {
    // Non-blocking: missing migrations or DB latency must never break coin pages.
  }
}

async function persistSongLink(songKey: string | null, artistKey: string | null, link: SongIntelLink, artistName?: string | null, songTitle?: string | null) {
  if (!link.url) return;
  try {
    await prisma.songExternalLink.upsert({
      where: { platform_url: { platform: link.platform, url: link.url } },
      create: {
        songKey,
        artistKey,
        songTitle,
        artistName,
        platform: link.platform,
        url: link.url,
        title: link.title,
        imageUrl: link.imageUrl,
        channelName: link.channelName,
        viewCount: link.viewCount,
        likeCount: link.likeCount,
        commentCount: link.commentCount,
        publishedAt: link.publishedAt ? new Date(link.publishedAt) : null,
        metricsJson: safeJson(link.metrics),
        confidence: link.confidence,
        sourceType: link.sourceType,
        status: "active",
        lastSyncedAt: new Date(),
      },
      update: {
        songKey,
        artistKey,
        songTitle,
        artistName,
        title: link.title,
        imageUrl: link.imageUrl,
        channelName: link.channelName,
        viewCount: link.viewCount,
        likeCount: link.likeCount,
        commentCount: link.commentCount,
        publishedAt: link.publishedAt ? new Date(link.publishedAt) : null,
        metricsJson: safeJson(link.metrics),
        confidence: link.confidence,
        status: "active",
        lastSyncedAt: new Date(),
      },
    });
  } catch {
    // Non-blocking.
  }
}

const memoryCache = new Map<string, { at: number; data: ArtistIntelResult }>();

export async function buildArtistIntel(input: ArtistIntelInput): Promise<ArtistIntelResult> {
  const local = await resolveLocalCoin(input);
  const artistName = input.artistName || local?.artistName || local?.artistWallet?.audiusName || null;
  const handle = input.handle || local?.artistWallet?.audiusHandle || null;
  const songTitle = input.songTitle || local?.title || null;
  const trackId = input.trackId || local?.audiusTrackId || null;
  const artistKey = key(handle || artistName || input.mint || "") || null;
  const songKey = key(trackId || `${artistName || ""}-${songTitle || ""}` || input.mint || "") || null;
  const cacheKey = `${artistKey || "artist"}:${songKey || "song"}:${input.mint || ""}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;

  const [manualArtistProfiles, manualLinks, audiusProfile, audiusTracks, spotifyProfile, spotifyTrack, youtubeLinks] = await Promise.all([
    manualProfiles(artistKey),
    manualSongLinks(songKey, artistKey),
    fetchAudiusProfile(handle),
    fetchAudiusTracks(handle, trackId),
    fetchSpotifyProfile(artistName),
    fetchSpotifyTrack(artistName, songTitle),
    fetchYouTubeMatches(artistName, songTitle),
  ]);

  const profiles = [
    ...manualArtistProfiles,
    ...(audiusProfile ? [audiusProfile] : []),
    ...(spotifyProfile ? [spotifyProfile] : []),
  ].filter((profile, index, all) => (
    profile.url && all.findIndex((item) => item.platform === profile.platform && item.url === profile.url) === index
  ));

  const songLinks = [
    ...manualLinks,
    ...(spotifyTrack ? [spotifyTrack] : []),
    ...youtubeLinks,
  ].filter((link, index, all) => (
    link.url && all.findIndex((item) => item.platform === link.platform && item.url === link.url) === index
  ));

  const tracks = audiusTracks.map((track: any) => ({
    id: String(track.id),
    title: track.title || "Untitled",
    url: track.permalink ? `https://audius.co${String(track.permalink).startsWith("/") ? track.permalink : `/${track.permalink}`}` : (handle ? `https://audius.co/${handle}` : "https://audius.co"),
    imageUrl: pickAudiusArtwork(track) ?? null,
    playCount: Number(track.play_count ?? 0) || null,
    favoriteCount: Number(track.favorite_count ?? 0) || null,
    repostCount: Number(track.repost_count ?? 0) || null,
  }));

  await Promise.all([
    ...profiles
      .filter((profile) => profile.sourceType === "auto_detected" && profile.confidence >= HIGH_CONFIDENCE)
      .map((profile) => persistProfile(artistKey, profile, artistName)),
    ...songLinks
      .filter((link) => link.sourceType === "auto_detected" && link.confidence >= HIGH_CONFIDENCE)
      .map((link) => persistSongLink(songKey, artistKey, link, artistName, songTitle)),
  ]);

  const result: ArtistIntelResult = {
    ok: true,
    artistKey,
    songKey,
    artistName,
    songTitle,
    profiles,
    songLinks,
    tracks,
    updatedAt: new Date().toISOString(),
    note: "Stats are estimates and may update with delay.",
  };
  memoryCache.set(cacheKey, { at: Date.now(), data: result });
  return result;
}
