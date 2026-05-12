import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { databaseReadiness } from "@/lib/appMode";
import { getConnection, isValidPubkey } from "@/lib/solana";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const database = databaseReadiness();
    if (!database.productionReady) {
      return NextResponse.json(
        { error: "Burn verification needs a reachable production database.", recommendation: database.recommendation },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const wallet = String(body?.wallet || "");
    const burnTxSig = String(body?.burnTxSig || "");
    const amount = Number(body?.amount || 0);
    if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
    if (!isValidPubkey(wallet)) return NextResponse.json({ error: "invalid wallet" }, { status: 422 });
    if (!burnTxSig) return NextResponse.json({ error: "burn transaction signature required" }, { status: 400 });
    if (!(amount > 0)) return NextResponse.json({ error: "burn amount must be greater than 0" }, { status: 422 });

    const song = await prisma.songToken.findFirst({
      where: {
        OR: [{ id: ctx.params.id }, { symbol: ctx.params.id.toUpperCase() }, { audiusTrackId: ctx.params.id }],
      },
    });
    if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });

    const conn = getConnection();
    const status = await conn.getSignatureStatus(burnTxSig, { searchTransactionHistory: true });
    const confirmation = status.value?.confirmationStatus;
    const confirmed = !!status.value && !status.value.err && (confirmation === "confirmed" || confirmation === "finalized");
    if (!confirmed) {
      return NextResponse.json({ error: "Burn is not confirmed yet." }, { status: 409 });
    }

    const user = await prisma.user.upsert({
      where: { wallet },
      create: { wallet, walletType: "solana" },
      update: {},
    });
    const nextSupply = Math.max(0, Number(song.supply || 0) - amount);
    const currentPriceSol = Number(song.currentPriceSol || song.price || 0);
    const currentPriceUsd = Number(song.currentPriceUsd || song.launchPriceUsd || 0);
    const updated = await prisma.songToken.update({
      where: { id: song.id },
      data: {
        supply: nextSupply,
        marketCap: currentPriceSol > 0 ? currentPriceSol * nextSupply : song.marketCap,
        marketCapUsd: currentPriceUsd > 0 ? currentPriceUsd * nextSupply : song.marketCapUsd,
      },
    });

    await prisma.marketEvent.create({
      data: {
        songId: song.id,
        kind: "BURN",
        payload: JSON.stringify({ wallet, amount, burnTxSig }),
      },
    }).catch(() => {});
    await prisma.transaction.create({
      data: {
        mode: song.mode || "live",
        isSimulated: Boolean(song.isSimulated),
        transactionSignature: burnTxSig,
        userId: user.id,
        walletAddress: wallet,
        coinId: song.id,
        action: "Burn",
        tokenAmount: amount,
        status: "confirmed",
      },
    }).catch(() => {});

    return NextResponse.json({
      song: updated,
      message: `Burn confirmed. ${amount.toLocaleString()} $${song.symbol} was permanently removed from supply.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to verify burn";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
