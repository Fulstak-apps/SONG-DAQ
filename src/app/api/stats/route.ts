import { NextResponse } from "next/server";
import { listCoins, hydrateArtists } from "@/lib/audiusCoins";
import { prisma } from "@/lib/db";
import { hasProductionDatabaseUrl } from "@/lib/appMode";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const coins = await hydrateArtists(await listCoins(100));
    const liveSongs = hasProductionDatabaseUrl()
      ? await prisma.songToken.findMany({
          where: { status: "LIVE", liquidityPairAmount: { gt: 0 }, liquidityTokenAmount: { gt: 0 } },
          select: { artistName: true, volume24h: true },
        }).catch(() => [])
      : [];

    const activeArtists = new Set<string>();
    for (const c of coins) activeArtists.add(c.owner_id || c.artist_handle || c.artist_name || c.ticker);
    for (const s of liveSongs) activeArtists.add(s.artistName);

    const tradingVolume =
      coins.reduce((sum, c) => sum + Number(c.v24hUSD ?? 0), 0) +
      liveSongs.reduce((sum, s) => sum + Number(s.volume24h ?? 0), 0);

    const songsTokenized =
      liveSongs.length +
      coins.filter((c) => c.audius_track_id || c.audius_track_title).length;

    return NextResponse.json({
      tradingVolume,
      activeArtists: activeArtists.size,
      songsTokenized,
      updatedAt: new Date().toISOString(),
      sources: ["Audius coins", "SONG·DAQ live song tokens"],
    });
  } catch (e: any) {
    return NextResponse.json({
      tradingVolume: 0,
      activeArtists: 0,
      songsTokenized: 0,
      updatedAt: new Date().toISOString(),
      error: e.message ?? "stats unavailable",
    }, { status: 200 });
  }
}
