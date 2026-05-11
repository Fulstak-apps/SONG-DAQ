import { NextRequest, NextResponse } from "next/server";
import { pickAudiusArtwork } from "@/lib/audiusArtwork";
import { fetchJson } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";

const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
const API_BASE = "https://api.audius.co";

function normalizeTrack(track: any) {
  const artwork = pickAudiusArtwork(track);
  return {
    ...track,
    artworkUrl: artwork,
    artwork_url: track?.artwork_url || artwork,
    image: track?.image || artwork,
  };
}

async function hosts(): Promise<string[]> {
  return [process.env.AUDIUS_DISCOVERY_HOST || API_BASE];
}

/**
 * GET /api/audius/tracks?handle=foo&limit=8
 * Returns the artist's most recent tracks for the "More from <artist>" panel.
 */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  if (!handle) return NextResponse.json({ tracks: [] });
  const all = await hosts();
  for (const host of all.slice(0, 4)) {
    try {
      // Resolve handle → user → tracks.
      const uj = await fetchJson<{ data?: any }>(
        `${host}/v1/users/handle/${encodeURIComponent(handle)}?app_name=${APP}`,
        { next: { revalidate: 600 } },
        4_500,
      ).catch(() => null);
      const userId = uj?.data?.id;
      if (!userId) continue;
      const tj = await fetchJson<{ data?: any[] }>(
        `${host}/v1/users/${encodeURIComponent(userId)}/tracks?app_name=${APP}&limit=${Math.min(20, Math.max(1, limit))}`,
        { next: { revalidate: 300 } },
        4_500,
      ).catch(() => null);
      if (!tj) continue;
      return NextResponse.json({ tracks: (tj?.data ?? []).map(normalizeTrack) });
    } catch { /* try next host */ }
  }
  return NextResponse.json({ tracks: [] });
}
