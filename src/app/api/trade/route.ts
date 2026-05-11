import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchJson } from "@/lib/fetchTimeout";
import { getConnection } from "@/lib/solana";
import { databaseReadiness } from "@/lib/appMode";
import {
  quoteBuyByTokens,
  quoteBuyBySol,
  quoteSellByTokens,
  spotPrice,
} from "@/lib/bondingCurve";

export const dynamic = "force-dynamic";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const API_KEY = process.env.JUPITER_API_KEY;
const API_BASE = process.env.JUPITER_API_BASE
  || (API_KEY ? "https://api.jup.ag/swap/v1" : "https://lite-api.jup.ag/swap/v1");

function jupiterHeaders() {
  const h: Record<string, string> = { accept: "application/json" };
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

function toRaw(amount: number, decimals: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  const fixed = amount.toFixed(decimals);
  const [whole, frac = ""] = fixed.split(".");
  return (BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0").slice(0, decimals) || "0")).toString();
}

function fromRaw(raw: string | number | bigint, decimals: number) {
  const value = Number(raw || 0);
  return value / 10 ** decimals;
}

function routeError(message?: string) {
  const raw = message || "No live swap route is available for this token right now.";
  const lower = raw.toLowerCase();
  if (lower.includes("not tradable") || lower.includes("no routes") || lower.includes("could not find any route")) {
    return "No live swap route is available for this token yet. The liquidity pool may need more indexing time or more depth.";
  }
  if (lower.includes("timeout") || lower.includes("aborted")) return "The live swap router timed out. Try again in a few seconds.";
  return raw;
}

async function liveQuote(song: any, side: string, tokens?: number, solIn?: number, slippageBps = 150) {
  if (!song.mintAddress) throw new Error("This Song Token does not have a mint address yet.");
  const params = {
    basePrice: song.basePrice,
    slope: song.curveSlope,
    circulating: song.circulating,
    performance: song.performance,
  };
  const fallback = side === "BUY"
    ? solIn && solIn > 0
      ? quoteBuyBySol(params, solIn)
      : quoteBuyByTokens(params, Number(tokens || 0))
    : quoteSellByTokens(params, Number(tokens || 0));
  const inputMint = side === "BUY" ? SOL_MINT : song.mintAddress;
  const outputMint = side === "BUY" ? song.mintAddress : SOL_MINT;
  const inputAmount = side === "BUY"
    ? toRaw(Number(solIn || fallback.total), 9)
    : toRaw(Number(tokens || 0), 6);
  if (BigInt(inputAmount) <= 0n) throw new Error("Enter an amount greater than zero.");

  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount: inputAmount,
    slippageBps: String(slippageBps),
    restrictIntermediateTokens: "true",
  });

  const quoteResponse = await fetchJson<any>(`${API_BASE}/quote?${qs.toString()}`, {
    headers: jupiterHeaders(),
    cache: "no-store",
  }, 5_000).catch((e) => {
    throw new Error(routeError(e?.message));
  });
  if (quoteResponse?.error) throw new Error(routeError(quoteResponse.error));

  const solTotal = side === "BUY" ? fromRaw(quoteResponse.inAmount, 9) : fromRaw(quoteResponse.outAmount, 9);
  const tokenTotal = side === "BUY" ? fromRaw(quoteResponse.outAmount, 6) : fromRaw(quoteResponse.inAmount, 6);
  const avgPrice = tokenTotal > 0 ? solTotal / tokenTotal : fallback.avgPrice;
  return {
    quoteResponse,
    quote: {
      ...fallback,
      total: solTotal,
      tokens: tokenTotal,
      avgPrice,
      fee: 0,
      slippageBps: Math.round(Number(quoteResponse.priceImpactPct || 0) * 10_000),
      newSpotPrice: avgPrice,
      executable: true,
      route: "Jupiter",
      inputMint,
      outputMint,
    },
  };
}

/** POST /api/trade — execute a buy or sell against the bonding curve. */
export async function POST(req: NextRequest) {
  const database = databaseReadiness();
  if (!database.productionReady) {
    return NextResponse.json(
      { error: "Trading needs a reachable production database.", recommendation: database.recommendation },
      { status: 503 },
    );
  }
  const body = await req.json();
  const {
    songId,
    side,                // "BUY" | "SELL"
    wallet,
    walletType = "solana",
    txSig,
    quoteResponse,
    tokens,
    solIn,
    maxSlippageBps = 150,
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
  const song = await prisma.songToken.findUnique({ where: { id: songId } });
  if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ((song as any).status !== "LIVE" || (song as any).liquidityPairAmount <= 0 || (song as any).liquidityTokenAmount <= 0) {
    return NextResponse.json({ error: "Trading unavailable: this Song Token is not live with verified launch liquidity" }, { status: 403 });
  }

  if (txSig) {
    const conn = getConnection();
    const status = await conn.getSignatureStatus(String(txSig), { searchTransactionHistory: true });
    const confirmation = status.value?.confirmationStatus;
    if (!status.value || (confirmation !== "confirmed" && confirmation !== "finalized")) {
      return NextResponse.json({ error: "Transaction is not confirmed on Solana yet" }, { status: 409 });
    }
    if (status.value.err) return NextResponse.json({ error: "Solana transaction failed", details: status.value.err }, { status: 422 });
    const user = await prisma.user.upsert({
      where: { wallet: String(wallet) },
      update: { walletType: "solana" },
      create: { wallet: String(wallet), walletType: "solana" },
    });
    const q = quoteResponse || {};
    const solAmount = side === "BUY" ? fromRaw(q.inAmount || 0, 9) : fromRaw(q.outAmount || 0, 9);
    const tokenAmount = side === "BUY" ? fromRaw(q.outAmount || 0, 6) : fromRaw(q.inAmount || 0, 6);
    await prisma.trade.create({
      data: {
        userId: user.id,
        songId: song.id,
        side,
        amount: tokenAmount,
        price: tokenAmount > 0 ? solAmount / tokenAmount : song.price,
        total: solAmount,
        fee: 0,
        txSig: String(txSig),
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true, txSig, solAmount, tokenAmount });
  }

  try {
    const route = await liveQuote(song, side, Number(tokens || 0), Number(solIn || 0), Number(maxSlippageBps || 150));
    const swap = await fetchJson<any>(`${API_BASE}/swap`, {
      method: "POST",
      headers: { ...jupiterHeaders(), "content-type": "application/json" },
      body: JSON.stringify({
        quoteResponse: route.quoteResponse,
        userPublicKey: wallet,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 1_000_000,
            priorityLevel: "high",
          },
        },
      }),
    }, 7_500);
    if (swap?.error) return NextResponse.json({ error: routeError(swap.error) }, { status: 503 });
    return NextResponse.json({ ...swap, quote: route.quote, quoteResponse: route.quoteResponse });
  } catch (e: any) {
    return NextResponse.json({ error: routeError(e?.message) }, { status: 503 });
  }
}

/** GET /api/trade?songId=...&side=...&tokens=... — preview a quote. */
export async function GET(req: NextRequest) {
  const database = databaseReadiness();
  if (!database.productionReady) {
    return NextResponse.json(
      { error: "Trading needs a reachable production database.", recommendation: database.recommendation, swapRouteReady: false },
      { status: 503 },
    );
  }
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
  try {
    const route = await liveQuote(song, side, tokens, solIn, Number(sp.get("slippageBps") || 150));
    return NextResponse.json({ quote: route.quote, spot: spotPrice(params), quoteResponse: route.quoteResponse, swapRouteReady: true });
  } catch (e: any) {
    return NextResponse.json({ quote: { ...quote, executable: false, route: "Waiting for Jupiter", routeError: routeError(e?.message) }, spot: spotPrice(params), swapRouteReady: false });
  }
}
