import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/userResolver";
import { getCoin } from "@/lib/audiusCoins";

export const dynamic = "force-dynamic";

/**
 * Trade Audius Artist Coins. Off-chain ledger keyed by mint; price comes
 * from the Audius coins index (live on-chain bonding-curve price). On
 * mainnet this would route through Solana → coin's dynamic bonding
 * curve; here we record the fill against the indexed price so the
 * portfolio stays consistent with /clubs.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { mint, side, amount, wallet, walletType = "solana", txSig } = body;
  if (!mint || !side || !amount || !wallet) {
    return NextResponse.json({ error: "mint, side, amount, wallet required" }, { status: 400 });
  }
  if (side !== "BUY" && side !== "SELL") {
    return NextResponse.json({ error: "side must be BUY or SELL" }, { status: 400 });
  }
  const tokens = Number(amount);
  if (!(tokens > 0)) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });

  const coin = await getCoin(String(mint));
  if (!coin) return NextResponse.json({ error: "coin not found on Audius" }, { status: 404 });

  const price = Number(coin.price ?? 0);
  if (!(price > 0)) return NextResponse.json({ error: "no live price for coin" }, { status: 422 });

  const user = await getOrCreateUser(wallet, walletType);
  const total = price * tokens;

  // Validate sell balance.
  if (side === "SELL") {
    const h = await prisma.coinHolding.findUnique({ where: { userId_mint: { userId: user.id, mint: coin.mint } } });
    if (!h || h.amount < tokens) return NextResponse.json({ error: "insufficient holding" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.coinTrade.create({
      data: { userId: user.id, mint: coin.mint, ticker: coin.ticker, side, amount: tokens, priceUsd: price, totalUsd: total, txSig: txSig ?? null },
    });
    const existing = await tx.coinHolding.findUnique({ where: { userId_mint: { userId: user.id, mint: coin.mint } } });
    if (side === "BUY") {
      if (existing) {
        const newAmt = existing.amount + tokens;
        const newCost = (existing.amount * existing.costBasis + total) / newAmt;
        await tx.coinHolding.update({ where: { id: existing.id }, data: { amount: newAmt, costBasis: newCost } });
      } else {
        await tx.coinHolding.create({ data: { userId: user.id, mint: coin.mint, ticker: coin.ticker, amount: tokens, costBasis: price } });
      }
    } else {
      const remaining = (existing?.amount ?? 0) - tokens;
      if (remaining <= 0.000001) {
        if (existing) await tx.coinHolding.delete({ where: { id: existing.id } });
      } else {
        await tx.coinHolding.update({ where: { id: existing!.id }, data: { amount: remaining } });
      }
    }
  });

  return NextResponse.json({ ok: true, fill: { ticker: coin.ticker, mint: coin.mint, side, amount: tokens, priceUsd: price, totalUsd: total } });
}
