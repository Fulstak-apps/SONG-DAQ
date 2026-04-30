import { NextRequest, NextResponse } from "next/server";
import { distributeRoyalty } from "@/lib/royalty";

export const dynamic = "force-dynamic";

/**
 * POST /api/royalty — simulate (or record) royalty inflow for a song.
 * In production this is invoked by a worker that observes Audius
 * payouts; in dev/devnet you can call it manually to test the flow.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { songId, amountSol, source = "audius" } = body ?? {};
  if (!songId || !amountSol || amountSol <= 0) {
    return NextResponse.json({ error: "songId, amountSol required" }, { status: 400 });
  }
  try {
    const result = await distributeRoyalty(songId, Number(amountSol), source);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
