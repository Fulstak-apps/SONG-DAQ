import { NextResponse } from "next/server";
import { listCoins, hydrateArtists } from "@/lib/audiusCoins";
import { prisma } from "@/lib/db";
import { databaseReadiness } from "@/lib/appMode";

export const dynamic = "force-dynamic";

const STATS_CACHE_MS = 60_000;
let statsCache: { at: number; data: Record<string, unknown> } | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(id));
  });
}

function canUseDatabaseForStats() {
  return databaseReadiness().productionReady;
}

export async function GET() {
  if (statsCache && Date.now() - statsCache.at < STATS_CACHE_MS) {
    return NextResponse.json({ ...statsCache.data, cached: true });
  }
  try {
    const rawCoins = await withTimeout(listCoins(60), 2_500, []);
    const coins = rawCoins.length
      ? await withTimeout(hydrateArtists(rawCoins), 4_800, rawCoins)
      : [];
    const liveSongs = canUseDatabaseForStats()
      ? await withTimeout(prisma.songToken.findMany({
          where: { status: "LIVE", liquidityPairAmount: { gt: 0 }, liquidityTokenAmount: { gt: 0 } },
          select: { artistName: true, volume24h: true, audiusTrackId: true, mintAddress: true },
        }), 2_000, []).catch(() => [])
      : [];

    const activeArtists = new Set<string>();
    for (const c of coins) activeArtists.add(c.owner_id || c.artist_handle || c.artist_name || c.ticker);
    for (const s of liveSongs) activeArtists.add(s.artistName);

    const tradingVolume =
      coins.reduce((sum, c) => sum + Number(c.v24hUSD ?? 0), 0) +
      liveSongs.reduce((sum, s) => sum + Number(s.volume24h ?? 0), 0);

    const tokenizedIds = new Set<string>();
    for (const s of liveSongs) tokenizedIds.add(s.audiusTrackId || s.mintAddress || s.artistName);
    for (const c of coins) tokenizedIds.add(c.audius_track_id || c.mint || c.ticker);

    const artistCoins = coins.length;
    const songCoins = liveSongs.length;
    const songsTokenized = Math.max(tokenizedIds.size, artistCoins + songCoins, artistCoins, songCoins);

    const data = {
      tradingVolume,
      activeArtists: activeArtists.size,
      artistCoins,
      songCoins,
      totalCoins: artistCoins + songCoins,
      songsTokenized,
      updatedAt: new Date().toISOString(),
      sources: [
        "Audius live music tokens",
        ...(liveSongs.length ? ["song-daq live song coins"] : []),
      ],
      databaseAvailable: canUseDatabaseForStats(),
    };
    statsCache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e: any) {
    const fallbackCoins = await listCoins(100).catch(() => []);
    const fallbackArtists = new Set(fallbackCoins.map((c) => c.owner_id || c.ticker).filter(Boolean));
    const data = {
      tradingVolume: fallbackCoins.reduce((sum, c) => sum + Number(c.v24hUSD ?? 0), 0),
      activeArtists: fallbackArtists.size,
      artistCoins: fallbackCoins.length,
      songCoins: 0,
      totalCoins: fallbackCoins.length,
      songsTokenized: Math.max(fallbackCoins.length, 0),
      updatedAt: new Date().toISOString(),
      error: e.message ?? "stats unavailable",
    };
    statsCache = { at: Date.now(), data };
    return NextResponse.json(data, { status: 200 });
  }
}
