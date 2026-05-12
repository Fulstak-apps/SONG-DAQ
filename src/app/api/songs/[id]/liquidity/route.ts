import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireArtist, AuthError } from "@/lib/auth";
import { getConnection, isValidPubkey } from "@/lib/solana";
import { canMarkLive, riskLevelForLiquidity, validateLaunchLiquidity } from "@/lib/launchState";
import { databaseReadiness } from "@/lib/appMode";
import { getAssetUsdRates } from "@/lib/serverAssetPrices";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const database = databaseReadiness();
    if (!database.productionReady) {
      return NextResponse.json(
        { error: "Liquidity verification needs a reachable production database.", recommendation: database.recommendation },
        { status: 503 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const {
      wallet,
      tokenAmount = 0,
      pairAmount = 0,
      pairAsset = "SOL",
      lockDays = 30,
      liquidityTxSig,
      poolId,
      lpMint,
    } = body ?? {};

    if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
    if (!isValidPubkey(String(wallet))) return NextResponse.json({ error: "invalid wallet" }, { status: 422 });

    const artist = await requireArtist(String(wallet));
    const song = await prisma.songToken.findFirst({
      where: {
        OR: [{ id: ctx.params.id }, { symbol: ctx.params.id.toUpperCase() }, { audiusTrackId: ctx.params.id }],
      },
      include: { artistWallet: { select: { wallet: true } } },
    });

    if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (song.artistWallet.wallet !== artist.user.wallet) {
      return NextResponse.json({ error: "Only the launching artist can add liquidity to this token" }, { status: 403 });
    }

    const normalized = validateLaunchLiquidity({ tokenAmount, pairAmount, lockDays, pairAsset });
    if (!normalized.ok) {
      return NextResponse.json(
        { error: "Liquidity is required before launch. This protects buyers and allows trading to start fairly.", details: normalized.errors },
        { status: 422 },
      );
    }
    if (!liquidityTxSig || !poolId) {
      return NextResponse.json(
        { error: "A confirmed liquidity transaction and pool address are required before a song coin can go live." },
        { status: 422 },
      );
    }

    const conn = getConnection();
    const status = await conn.getSignatureStatus(String(liquidityTxSig), { searchTransactionHistory: true });
    const confirmation = status.value?.confirmationStatus;
    const confirmed = !!status.value && !status.value.err && (confirmation === "confirmed" || confirmation === "finalized");
    const liveCheck = canMarkLive({
      tokenAmount: normalized.tokenAmount,
      pairAmount: normalized.pairAmount,
      pairAsset: normalized.pairAsset,
      lockDays: normalized.lockDays,
      liquidityTxSig: String(liquidityTxSig),
      poolId: String(poolId),
      confirmed,
    });
    if (!liveCheck.ok) {
      await prisma.songToken.update({
        where: { id: song.id },
        data: { status: "VERIFYING_LIQUIDITY" },
      }).catch(() => {});
      return NextResponse.json({ error: "Liquidity is not confirmed yet.", details: liveCheck.errors }, { status: 409 });
    }

    const rates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", normalized.pairAsset]);
    const pairUsdRate = normalized.pairAsset === "USDC" ? 1 : Number(rates[normalized.pairAsset] || 0);
    const solUsdRate = Number(rates.SOL || 0);
    const startingPairPrice = normalized.pairAmount / Math.max(normalized.tokenAmount, 1);
    const currentPriceUsd = pairUsdRate > 0 ? startingPairPrice * pairUsdRate : Number(song.currentPriceUsd || song.launchPriceUsd || 0);
    const currentPriceSol = normalized.pairAsset === "SOL"
      ? startingPairPrice
      : currentPriceUsd > 0 && solUsdRate > 0
        ? currentPriceUsd / solUsdRate
        : Number(song.currentPriceSol || song.launchPriceSol || song.price || 0);
    const supply = Number(song.supply || 0);
    const publicMarketSupply = Math.max(0, Math.min(normalized.tokenAmount, supply || normalized.tokenAmount));
    const launchLiquidityUsd = pairUsdRate > 0 ? normalized.pairAmount * pairUsdRate : Number(song.launchLiquidityUsd || 0);

    const updated = await prisma.songToken.update({
      where: { id: song.id },
      data: {
        liquidityTokenAmount: normalized.tokenAmount,
        liquidityPairAmount: normalized.pairAmount,
        liquidityPairAsset: normalized.pairAsset,
        liquidityLockDays: normalized.lockDays,
        liquidityLocked: true,
        liquidityHealth: liveCheck.health,
        launchPriceSol: currentPriceSol || song.launchPriceSol,
        launchPriceUsd: currentPriceUsd || song.launchPriceUsd,
        currentPriceSol: currentPriceSol || song.currentPriceSol,
        currentPriceUsd: currentPriceUsd || song.currentPriceUsd,
        price: currentPriceSol || song.price,
        marketCap: currentPriceSol > 0 && publicMarketSupply > 0 ? currentPriceSol * publicMarketSupply : song.marketCap,
        marketCapUsd: currentPriceUsd > 0 && publicMarketSupply > 0 ? currentPriceUsd * publicMarketSupply : song.marketCapUsd,
        launchLiquiditySol: normalized.pairAsset === "SOL" ? normalized.pairAmount : song.launchLiquiditySol,
        launchLiquidityUsd: launchLiquidityUsd || song.launchLiquidityUsd,
        status: "LIVE",
        riskLevel: riskLevelForLiquidity(liveCheck.health),
      },
    });

    await prisma.marketEvent.create({
      data: {
        songId: song.id,
        kind: "LIQUIDITY",
        payload: JSON.stringify({
          liquidity: {
            tokenAmount: normalized.tokenAmount,
            pairAmount: normalized.pairAmount,
            pairAsset: normalized.pairAsset,
            lockDays: normalized.lockDays,
            liquidityTxSig: liquidityTxSig ? String(liquidityTxSig) : null,
            poolId: poolId ? String(poolId) : null,
            lpMint: lpMint ? String(lpMint) : null,
          },
          wallet,
        }),
      },
    });
    await prisma.transaction.create({
      data: {
        mode: song.mode || "live",
        isSimulated: Boolean(song.isSimulated),
        transactionSignature: String(liquidityTxSig),
        userId: artist.user.id,
        walletAddress: String(wallet),
        coinId: song.id,
        action: "Add Launch Liquidity",
        solAmount: normalized.pairAsset === "SOL" ? normalized.pairAmount : undefined,
        usdAmount: launchLiquidityUsd || undefined,
        tokenAmount: normalized.tokenAmount,
        status: "confirmed",
      },
    }).catch(() => {});

    return NextResponse.json({
      song: updated,
      message: "Liquidity added. This Song Coin is now marked live in the app.",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to add liquidity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
