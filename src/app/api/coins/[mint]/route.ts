import { NextRequest, NextResponse } from "next/server";
import { getCoin, hydrateArtists } from "@/lib/audiusCoins";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { mint: string } }) {
  try {
    const c = await getCoin(ctx.params.mint);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    const [enriched] = await hydrateArtists([c]);
    return NextResponse.json({ coin: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
