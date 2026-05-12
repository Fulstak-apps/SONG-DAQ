import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { databaseReadiness } from "@/lib/appMode";
import { getConnection, isValidPubkey } from "@/lib/solana";
import { getAssetUsdRates, valueLocalSongCoin } from "@/lib/serverAssetPrices";
import {
  applyBurnToSupply,
  calculateSupplyDistribution,
  getBurnedSupplyFromEvents,
} from "@/lib/supplyDistribution";

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
      include: {
        artistWallet: { select: { wallet: true } },
        events: {
          where: { kind: "BURN" },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { kind: true, payload: true },
        },
      },
    });
    if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (amount > Number(song.supply || 0)) {
      return NextResponse.json({ error: "Burn amount is larger than the current indexed supply." }, { status: 422 });
    }

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

    const previousBurnedSupply = getBurnedSupplyFromEvents(song.events);
    const burnedFromArtistWallet = Boolean(song.artistWallet?.wallet && song.artistWallet.wallet === wallet);
    const previousDistribution = calculateSupplyDistribution({
      supply: song.supply,
      circulating: song.circulating,
      liquidityTokenAmount: song.liquidityTokenAmount,
      artistAllocationBps: song.artistAllocationBps,
      burnedSupply: previousBurnedSupply,
    });
    const nextSupply = applyBurnToSupply(
      {
        supply: song.supply,
        circulating: song.circulating,
        liquidityTokenAmount: song.liquidityTokenAmount,
        artistAllocationBps: song.artistAllocationBps,
        burnedSupply: previousBurnedSupply,
      },
      amount,
      burnedFromArtistWallet,
    );
    const cumulativeBurned = previousBurnedSupply + amount;
    const rates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", song.liquidityPairAsset]);
    const nextValuation = valueLocalSongCoin(
      {
        ...song,
        supply: nextSupply.supply,
        circulating: nextSupply.circulating,
        liquidityTokenAmount: nextSupply.liquidityTokenAmount,
      },
      rates,
    );
    const updated = await prisma.songToken.update({
      where: { id: song.id },
      data: {
        supply: nextSupply.supply,
        circulating: nextSupply.circulating,
        liquidityTokenAmount: nextSupply.liquidityTokenAmount,
        artistAllocationBps: nextSupply.artistAllocationBps,
        price: nextValuation.priceSol || song.price,
        currentPriceSol: nextValuation.priceSol || song.currentPriceSol,
        currentPriceUsd: nextValuation.priceUsd || song.currentPriceUsd,
        marketCap: nextValuation.marketValueSol || 0,
        marketCapUsd: nextValuation.marketValueUsd || 0,
        launchLiquidityUsd: nextValuation.liquidityUsd || song.launchLiquidityUsd,
      },
    });

    await prisma.marketEvent.create({
      data: {
        songId: song.id,
        kind: "BURN",
        payload: JSON.stringify({
          wallet,
          amount,
          burnTxSig,
          burnedFrom: burnedFromArtistWallet ? "artist_allocation" : "holder_wallet",
          previousSupply: Number(song.supply || 0),
          nextSupply: nextSupply.supply,
          cumulativeBurned,
          previousDistribution,
          nextDistribution: nextSupply.distribution,
          royaltySplitDistribution: {
            artistShareBps: song.artistShareBps,
            holderShareBps: song.holderShareBps,
            protocolShareBps: song.protocolShareBps,
          },
          valuation: {
            priceSol: nextValuation.priceSol,
            priceUsd: nextValuation.priceUsd,
            marketValueSol: nextValuation.marketValueSol,
            marketValueUsd: nextValuation.marketValueUsd,
            marketValueBasis: nextValuation.basis,
          },
        }),
      },
    }).catch(() => {});

    await updateBurnedPositions({
      userId: user.id,
      wallet,
      songId: song.id,
      mode: song.mode || "live",
      amount,
      priceSol: nextValuation.priceSol,
      priceUsd: nextValuation.priceUsd,
    });

    await prisma.transaction.create({
      data: {
        mode: song.mode || "live",
        isSimulated: Boolean(song.isSimulated),
        transactionSignature: burnTxSig,
        userId: user.id,
        walletAddress: wallet,
        coinId: song.id,
        action: "Burn",
        solAmount: nextValuation.priceSol > 0 ? nextValuation.priceSol * amount : undefined,
        usdAmount: nextValuation.priceUsd > 0 ? nextValuation.priceUsd * amount : undefined,
        tokenAmount: amount,
        status: "confirmed",
      },
    }).catch(() => {});

    return NextResponse.json({
      song: {
        ...updated,
        burnedSupply: cumulativeBurned,
        supplyDistribution: nextSupply.distribution,
        tradableSupply: nextValuation.tradableSupply,
        fullyDilutedValueUsd: nextValuation.fullyDilutedValueUsd,
        marketValueBasis: nextValuation.basis,
        marketValueNote: nextValuation.note,
        isMarketValueReliable: nextValuation.isMarketValueReliable,
      },
      message: `Burn confirmed. ${amount.toLocaleString()} $${song.symbol} was permanently removed from supply.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to verify burn";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function updateBurnedPositions({
  userId,
  wallet,
  songId,
  mode,
  amount,
  priceSol,
  priceUsd,
}: {
  userId: string;
  wallet: string;
  songId: string;
  mode: string;
  amount: number;
  priceSol: number;
  priceUsd: number;
}) {
  await prisma.holding.findFirst({ where: { userId, songId } }).then(async (holding) => {
    if (!holding) return;
    const nextAmount = Math.max(0, Number(holding.amount || 0) - amount);
    if (nextAmount <= 0) {
      await prisma.holding.delete({ where: { id: holding.id } });
      return;
    }
    await prisma.holding.update({ where: { id: holding.id }, data: { amount: nextAmount } });
  }).catch(() => {});

  await prisma.portfolioPosition.findFirst({ where: { walletAddress: wallet, coinId: songId, mode } }).then(async (position) => {
    if (!position) return;
    const nextAmount = Math.max(0, Number(position.tokenAmount || 0) - amount);
    if (nextAmount <= 0) {
      await prisma.portfolioPosition.delete({ where: { id: position.id } });
      return;
    }
    const currentValueSol = priceSol > 0 ? nextAmount * priceSol : position.currentValueSol;
    const currentValueUsd = priceUsd > 0 ? nextAmount * priceUsd : position.currentValueUsd;
    await prisma.portfolioPosition.update({
      where: { id: position.id },
      data: {
        tokenAmount: nextAmount,
        currentValueSol,
        currentValueUsd,
        unrealizedGainLossUsd: currentValueUsd - nextAmount * Number(position.averageBuyPriceUsd || 0),
      },
    });
  }).catch(() => {});
}
