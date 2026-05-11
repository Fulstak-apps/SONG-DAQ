import { NextRequest, NextResponse } from "next/server";
import { searchTracks, trendingTracks } from "@/lib/audius";

export const dynamic = "force-dynamic";

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; tracks: unknown[] }>();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const key = q.trim().toLowerCase() || "__trending__";
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ tracks: cached.tracks, cached: true });
  }
  try {
    const tracks = q ? await searchTracks(q, 18) : await trendingTracks(18);
    cache.set(key, { at: Date.now(), tracks });
    return NextResponse.json({ tracks });
  } catch (e: any) {
    if (cached?.tracks.length) return NextResponse.json({ tracks: cached.tracks, cached: true, stale: true });
    return NextResponse.json({ tracks: [], error: e.message }, { status: 200 });
  }
}
