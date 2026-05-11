import { NextRequest, NextResponse } from "next/server";
import { searchTracks, trendingTracks } from "@/lib/audius";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const tracks = q ? await searchTracks(q, 18) : await trendingTracks(18);
    return NextResponse.json({ tracks });
  } catch (e: any) {
    return NextResponse.json({ tracks: [], error: e.message }, { status: 200 });
  }
}
