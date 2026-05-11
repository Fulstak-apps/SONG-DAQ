import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCoin } from "@/lib/audiusCoins";
import { getConnection } from "@/lib/solana";

export const dynamic = "force-dynamic";

/**
 * Records a confirmed Artist Token swap. Execution must happen through the
 * user's Solana wallet first; this endpoint only indexes confirmed activity
 * so portfolio, feed, and recent trade UI can refresh without inventing fills.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    mint,
    side,
    amount,
    wallet,
    walletType = "solana",
    txSig,
    ticker,
    priceUsd,
    totalUsd,
  } = body;
  if (!mint || !side || !amount || !wallet) {
    return NextResponse.json({ error: "mint, side, amount, wallet required" }, { status: 400 });
  }
  if (side !== "BUY" && side !== "SELL") {
    return NextResponse.json({ error: "side must be BUY or SELL" }, { status: 400 });
  }
  if (walletType !== "solana") {
    return NextResponse.json({ error: "Artist Token trades require a Solana wallet" }, { status: 400 });
  }
  if (!txSig) {
    return NextResponse.json({ error: "A confirmed Solana transaction signature is required" }, { status: 401 });
  }

  const conn = getConnection();
  const status = await conn.getSignatureStatus(String(txSig), { searchTransactionHistory: true });
  const confirmation = status.value?.confirmationStatus;
  if (!status.value || (confirmation !== "confirmed" && confirmation !== "finalized")) {
    return NextResponse.json({ error: "Transaction is not confirmed on Solana yet" }, { status: 409 });
  }
  if (status.value.err) {
    return NextResponse.json({ error: "Solana transaction failed", details: status.value.err }, { status: 422 });
  }

  const existing = await prisma.coinTrade.findFirst({ where: { txSig: String(txSig) } });
  if (existing) return NextResponse.json({ trade: existing, duplicate: true });

  const user = await prisma.user.upsert({
    where: { wallet: String(wallet) },
    update: { walletType: "solana" },
    create: { wallet: String(wallet), walletType: "solana" },
  });
  const coin = await getCoin(String(mint)).catch(() => null);
  const cleanAmount = Math.max(0, Number(amount));
  const cleanPrice = Number.isFinite(Number(priceUsd)) ? Number(priceUsd) : Number(coin?.price ?? 0);
  const cleanTotal = Number.isFinite(Number(totalUsd)) ? Number(totalUsd) : cleanAmount * cleanPrice;
  const cleanTicker = String(ticker || coin?.ticker || String(mint).slice(0, 4)).toUpperCase();

  const trade = await prisma.coinTrade.create({
    data: {
      userId: user.id,
      mint: String(mint),
      ticker: cleanTicker,
      side,
      amount: cleanAmount,
      priceUsd: cleanPrice,
      totalUsd: cleanTotal,
      txSig: String(txSig),
    },
  });

  const holding = await prisma.coinHolding.findUnique({
    where: { userId_mint: { userId: user.id, mint: String(mint) } },
  });
  const nextAmount = side === "BUY"
    ? (holding?.amount ?? 0) + cleanAmount
    : Math.max(0, (holding?.amount ?? 0) - cleanAmount);
  const nextCost = side === "BUY"
    ? (holding?.costBasis ?? 0) + cleanTotal
    : Math.max(0, (holding?.costBasis ?? 0) - cleanTotal);

  await prisma.coinHolding.upsert({
    where: { userId_mint: { userId: user.id, mint: String(mint) } },
    update: { amount: nextAmount, costBasis: nextCost, ticker: cleanTicker },
    create: { userId: user.id, mint: String(mint), ticker: cleanTicker, amount: nextAmount, costBasis: nextCost },
  });

  return NextResponse.json({ trade });
}
