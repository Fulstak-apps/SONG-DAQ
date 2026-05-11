import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  quoteBuyByTokens,
  quoteBuyBySol,
  quoteSellByTokens,
  spotPrice,
} from "@/lib/bondingCurve";

export const dynamic = "force-dynamic";

/** POST /api/trade — execute a buy or sell against the bonding curve. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    songId,
    side,                // "BUY" | "SELL"
    wallet,
    walletType = "solana",
    txSig,
  } = body ?? {};

  if (!songId || !side || !wallet) {
    return NextResponse.json({ error: "songId, side, wallet required" }, { status: 400 });
  }
  if (side !== "BUY" && side !== "SELL") {
    return NextResponse.json({ error: "side must be BUY or SELL" }, { status: 400 });
  }
  if (walletType !== "solana") {
    return NextResponse.json({ error: "SONG·DAQ trading is Solana-only" }, { status: 400 });
  }
  if (!txSig) {
    return NextResponse.json({ error: "A confirmed Solana transaction signature is required" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Song Token trading opens after a verified liquidity pool or Jupiter route is connected. No off-chain fills are recorded.",
    },
    { status: 503 },
  );
}

/** GET /api/trade?songId=...&side=...&tokens=... — preview a quote. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const songId = sp.get("songId");
  const side = (sp.get("side") || "BUY").toUpperCase();
  const tokens = sp.get("tokens") ? Number(sp.get("tokens")) : undefined;
  const solIn = sp.get("solIn") ? Number(sp.get("solIn")) : undefined;
  if (!songId) return NextResponse.json({ error: "songId required" }, { status: 400 });
  const song = await prisma.songToken.findUnique({ where: { id: songId } });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ((song as any).status !== "LIVE" || (song as any).liquidityPairAmount <= 0 || (song as any).liquidityTokenAmount <= 0) {
    return NextResponse.json({ error: "Trading unavailable: this Song Token is not live with verified launch liquidity" }, { status: 403 });
  }
  const params = {
    basePrice: song.basePrice,
    slope: song.curveSlope,
    circulating: song.circulating,
    performance: song.performance,
  };
  let quote;
  try {
    if (side === "BUY") {
      let effectiveSolIn = solIn;
      if (effectiveSolIn) quote = quoteBuyBySol(params, effectiveSolIn);
      else if (tokens) quote = quoteBuyByTokens(params, tokens);
      else return NextResponse.json({ error: "tokens or amount required" }, { status: 400 });
      if (quote.tokens > song.supply * ((song as any).maxWalletBps / 10_000)) {
        return NextResponse.json({ error: "Quote exceeds max wallet cap for this launch" }, { status: 403 });
      }
    } else {
      if (!tokens) return NextResponse.json({ error: "tokens required" }, { status: 400 });
      quote = quoteSellByTokens(params, tokens);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  return NextResponse.json({ quote, spot: spotPrice(params) });
}
