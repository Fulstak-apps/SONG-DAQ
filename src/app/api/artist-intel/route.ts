import { NextRequest, NextResponse } from "next/server";
import { buildArtistIntel } from "@/lib/artistIntel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const input = {
    mint: req.nextUrl.searchParams.get("mint"),
    artistName: req.nextUrl.searchParams.get("artistName"),
    handle: req.nextUrl.searchParams.get("handle"),
    songTitle: req.nextUrl.searchParams.get("songTitle"),
    trackId: req.nextUrl.searchParams.get("trackId"),
  };

  try {
    const data = await buildArtistIntel(input);
    return NextResponse.json(data);
  } catch (error) {
    console.error("artist intel failed", error);
    // Never break the market/coin page because enrichment is slow or missing.
    return NextResponse.json({
      ok: true,
      artistKey: null,
      songKey: null,
      artistName: input.artistName ?? null,
      songTitle: input.songTitle ?? null,
      profiles: [],
      songLinks: [],
      tracks: [],
      updatedAt: new Date().toISOString(),
      note: "Stats are estimates and may update with delay.",
    });
  }
}
