import { NextResponse } from "next/server";
import { listCoins, hydrateArtists } from "@/lib/audiusCoins";
import { prisma } from "@/lib/db";
import { hasProductionDatabaseUrl } from "@/lib/appMode";

export const dynamic = "force-dynamic";

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
  const url = process.env.DATABASE_URL || "";
  if (!hasProductionDatabaseUrl(url)) return false;
  // Render often cannot reach Supabase's direct IPv6 database host on :5432.
  // Use the pooler URL for production DB stats; until then, keep public stats
  // fast and correct from the live Audius coin feed instead of blocking pages.
  if (url.includes("db.ghktjraydijlsiotmmda.supabase.co:5432")) return false;
  return true;
}

export async function GET() {
  try {
    const rawCoins = await withTimeout(listCoins(100), 3_000, []);
    const coins = rawCoins.length
      ? await withTimeout(hydrateArtists(rawCoins), 3_500, rawCoins)
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

    const songsTokenized = tokenizedIds.size;

    return NextResponse.json({
      tradingVolume,
      activeArtists: activeArtists.size,
      songsTokenized,
      updatedAt: new Date().toISOString(),
      sources: [
        "Audius live music tokens",
        ...(liveSongs.length ? ["SONG·DAQ live song tokens"] : []),
      ],
      databaseAvailable: canUseDatabaseForStats(),
    });
  } catch (e: any) {
    const fallbackCoins = await listCoins(100).catch(() => []);
    const fallbackArtists = new Set(fallbackCoins.map((c) => c.owner_id || c.ticker).filter(Boolean));
    return NextResponse.json({
      tradingVolume: fallbackCoins.reduce((sum, c) => sum + Number(c.v24hUSD ?? 0), 0),
      activeArtists: fallbackArtists.size,
      songsTokenized: fallbackCoins.length,
      updatedAt: new Date().toISOString(),
      error: e.message ?? "stats unavailable",
    }, { status: 200 });
  }
}
