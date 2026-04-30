import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/userResolver";
import {
  quoteBuyByTokens,
  quoteBuyBySol,
  quoteSellByTokens,
  spotPrice,
  marketCap,
} from "@/lib/bondingCurve";
import { cachePub } from "@/lib/redis";

export const dynamic = "force-dynamic";

/** POST /api/trade — execute a buy or sell against the bonding curve. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    songId,
    side,                // "BUY" | "SELL"
    tokens,              // optional — exact tokens
    solIn,               // optional — buy by SOL amount
    wallet,
    walletType = "solana",
    maxSlippageBps = 1500,
    txSig,
    asset = "SOL", // "SOL" | "AUDIO"
  } = body ?? {};

  if (!songId || !side || !wallet) {
    return NextResponse.json({ error: "songId, side, wallet required" }, { status: 400 });
  }
  if (side !== "BUY" && side !== "SELL") {
    return NextResponse.json({ error: "side must be BUY or SELL" }, { status: 400 });
  }

  const song = await prisma.songToken.findUnique({ where: { id: songId } });
  if (!song) return NextResponse.json({ error: "song not found" }, { status: 404 });

  const user = await getOrCreateUser(wallet, walletType);
  // Issuer-privilege rule: an artist cannot trade their own token (no self-pump).
  if (song.artistWalletId === user.id) {
    return NextResponse.json(
      { error: "Artists cannot trade their own song tokens" },
      { status: 403 },
    );
  }

  const params = {
    basePrice: song.basePrice,
    slope: song.curveSlope,
    circulating: song.circulating,
    performance: song.performance,
  };

  let quote;
  if (side === "BUY") {
    // Mock exchange rate: 1 AUDIO = 0.002 SOL
    let effectiveSolIn = solIn;
    if (asset === "AUDIO" && solIn && solIn > 0) {
      effectiveSolIn = solIn * 0.002;
    }
    
    if (effectiveSolIn && effectiveSolIn > 0) quote = quoteBuyBySol(params, Number(effectiveSolIn));
    else if (tokens && tokens > 0) quote = quoteBuyByTokens(params, Number(tokens));
    else return NextResponse.json({ error: "tokens or amount required" }, { status: 400 });
    
    if (quote.newCirculating > song.supply) {
      return NextResponse.json({ error: "Exceeds total supply" }, { status: 400 });
    }
  } else {
    if (!tokens || tokens <= 0) return NextResponse.json({ error: "tokens required for SELL" }, { status: 400 });
    const holding = await prisma.holding.findUnique({
      where: { userId_songId: { userId: user.id, songId: song.id } },
    });
    if (!holding || holding.amount < Number(tokens)) {
      return NextResponse.json({ error: "Insufficient holding" }, { status: 400 });
    }
    quote = quoteSellByTokens(params, Number(tokens));
  }

  if (Math.abs(quote.slippageBps) > Number(maxSlippageBps)) {
    return NextResponse.json(
      { error: "Slippage exceeded", slippageBps: quote.slippageBps },
      { status: 422 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const isAth = quote.newSpotPrice > (song.ath || 0);
    const updatedSong = await tx.songToken.update({
      where: { id: song.id },
      data: {
        circulating: quote.newCirculating,
        reserveSol: side === "BUY"
          ? { increment: quote.cost }
          : { decrement: quote.cost },
        price: quote.newSpotPrice,
        marketCap: marketCap({ ...params, circulating: quote.newCirculating }),
        volume24h: { increment: side === "BUY" ? quote.total : quote.cost },
        ath: isAth ? quote.newSpotPrice : undefined,
        athAt: isAth ? new Date() : undefined,
      },
    });
    if (isAth) {
      await tx.marketEvent.create({
        data: {
          songId: song.id,
          kind: "ATH",
          payload: JSON.stringify({ symbol: song.symbol, price: quote.newSpotPrice }),
        },
      });
    }
    if (quote.total >= 5) {
      await tx.marketEvent.create({
        data: {
          songId: song.id,
          kind: "WHALE",
          payload: JSON.stringify({ symbol: song.symbol, side, total: quote.total, wallet }),
        },
      });
    }

    const trade = await tx.trade.create({
      data: {
        userId: user.id,
        songId: song.id,
        side,
        amount: quote.tokens,
        price: quote.avgPrice,
        total: quote.total,
        fee: quote.fee,
        txSig: txSig ?? null,
      },
    });

    if (side === "BUY") {
      const existing = await tx.holding.findUnique({
        where: { userId_songId: { userId: user.id, songId: song.id } },
      });
      if (existing) {
        const totalCost = existing.amount * existing.costBasis + quote.total;
        const totalAmt = existing.amount + quote.tokens;
        await tx.holding.update({
          where: { userId_songId: { userId: user.id, songId: song.id } },
          data: { amount: totalAmt, costBasis: totalCost / totalAmt },
        });
      } else {
        await tx.holding.create({
          data: {
            userId: user.id,
            songId: song.id,
            amount: quote.tokens,
            costBasis: quote.avgPrice,
          },
        });
      }
    } else {
      const existing = await tx.holding.findUnique({
        where: { userId_songId: { userId: user.id, songId: song.id } },
      });
      if (existing) {
        const remaining = existing.amount - quote.tokens;
        if (remaining <= 0.0000001) {
          await tx.holding.delete({
            where: { userId_songId: { userId: user.id, songId: song.id } },
          });
        } else {
          await tx.holding.update({
            where: { userId_songId: { userId: user.id, songId: song.id } },
            data: { amount: remaining },
          });
        }
      }
    }

    await tx.marketEvent.create({
      data: {
        songId: song.id,
        kind: side,
        payload: JSON.stringify({
          wallet,
          tokens: quote.tokens,
          price: quote.avgPrice,
          total: quote.total,
          symbol: song.symbol,
        }),
      },
    });

    // Append a price point (1-min candle bucket).
    const now = new Date();
    const bucket = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    const last = await tx.pricePoint.findFirst({
      where: { songId: song.id },
      orderBy: { ts: "desc" },
    });
    if (last && last.ts.getTime() === bucket.getTime()) {
      await tx.pricePoint.update({
        where: { id: last.id },
        data: {
          high: Math.max(last.high, quote.newSpotPrice),
          low: Math.min(last.low, quote.newSpotPrice),
          close: quote.newSpotPrice,
          volume: { increment: quote.total },
        },
      });
    } else {
      const open = last?.close ?? spotPrice(params);
      await tx.pricePoint.create({
        data: {
          songId: song.id,
          ts: bucket,
          open,
          high: Math.max(open, quote.newSpotPrice),
          low: Math.min(open, quote.newSpotPrice),
          close: quote.newSpotPrice,
          volume: quote.total,
        },
      });
    }

    return { trade, song: updatedSong };
  });

  await cachePub("trades", {
    songId: song.id,
    symbol: song.symbol,
    side,
    amount: quote.tokens,
    price: quote.avgPrice,
    ts: Date.now(),
  });

  return NextResponse.json({ ...result, quote });
}

/** GET /api/trade?songId=...&side=...&tokens=... — preview a quote. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const songId = sp.get("songId");
  const side = (sp.get("side") || "BUY").toUpperCase();
  const tokens = sp.get("tokens") ? Number(sp.get("tokens")) : undefined;
  const solIn = sp.get("solIn") ? Number(sp.get("solIn")) : undefined;
  const asset = sp.get("asset") || "SOL";
  if (!songId) return NextResponse.json({ error: "songId required" }, { status: 400 });
  const song = await prisma.songToken.findUnique({ where: { id: songId } });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
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
      if (asset === "AUDIO" && solIn) effectiveSolIn = solIn * 0.002;
      
      if (effectiveSolIn) quote = quoteBuyBySol(params, effectiveSolIn);
      else if (tokens) quote = quoteBuyByTokens(params, tokens);
      else return NextResponse.json({ error: "tokens or amount required" }, { status: 400 });
    } else {
      if (!tokens) return NextResponse.json({ error: "tokens required" }, { status: 400 });
      quote = quoteSellByTokens(params, tokens);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  return NextResponse.json({ quote, spot: spotPrice(params) });
}
