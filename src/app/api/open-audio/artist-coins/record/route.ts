import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { requireArtist, AuthError } from "@/lib/auth";
import { databaseReadiness } from "@/lib/appMode";
import { getConnection, isValidPubkey } from "@/lib/solana";
import {
  AUDIO_MINT,
  OPEN_AUDIO_ARTIST_DECIMALS,
  OPEN_AUDIO_ARTIST_SUPPLY,
  OPEN_AUDIO_ARTIST_VESTING_BPS,
  OPEN_AUDIO_GRADUATION_MARKET_CAP_AUDIO,
  OPEN_AUDIO_INITIAL_MARKET_CAP_AUDIO,
  OPEN_AUDIO_LOCKED_AMM_LIQUIDITY_BPS,
  OPEN_AUDIO_PUBLIC_CURVE_BPS,
  OPEN_AUDIO_REWARD_POOL_BPS,
  sanitizeArtistCoinName,
  sanitizeArtistCoinSymbol,
} from "@/lib/openAudioArtistCoins";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const database = databaseReadiness();
    if (!database.productionReady) {
      return NextResponse.json(
        { error: "Artist Coin recording is locked until the production database is reachable.", recommendation: database.recommendation },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const wallet = String(body.wallet || "");
    const mint = String(body.mint || "");
    const signature = String(body.signature || "");
    const poolAddress = String(body.poolAddress || "");
    if (!isValidPubkey(wallet)) return NextResponse.json({ error: "Valid artist Solana wallet required" }, { status: 422 });
    if (!isValidPubkey(mint)) return NextResponse.json({ error: "Valid Artist Coin mint required" }, { status: 422 });
    if (!signature) return NextResponse.json({ error: "Launch transaction signature required" }, { status: 422 });

    const artist = await requireArtist(wallet);
    const conn = getConnection();
    const status = await conn.getSignatureStatus(signature, { searchTransactionHistory: true });
    const confirmation = status.value?.confirmationStatus;
    if (!status.value || (confirmation !== "confirmed" && confirmation !== "finalized")) {
      return NextResponse.json({ error: "Artist Coin launch transaction is not confirmed on Solana yet" }, { status: 409 });
    }
    if (status.value.err) return NextResponse.json({ error: "Artist Coin launch transaction failed on Solana", details: status.value.err }, { status: 422 });

    const supplyInfo = await conn.getTokenSupply(new PublicKey(mint));
    if (Number(supplyInfo.value.decimals) !== OPEN_AUDIO_ARTIST_DECIMALS) {
      return NextResponse.json({ error: "Artist Coin mint does not use the Open Audio 9-decimal standard" }, { status: 422 });
    }

    const artistUser = artist.user as any;
    const artistName = String(body.artistName || artistUser.audiusName || artistUser.name || artist.user.audiusHandle || "Artist");
    const symbol = `$${sanitizeArtistCoinSymbol(String(body.symbol || artist.user.audiusHandle || artistName))}`;
    const name = sanitizeArtistCoinName(String(body.name || artistName));
    const artistCoinId = `artist-coin:${artist.user.audiusUserId || artist.user.wallet}`;
    const existing = await prisma.songToken.findFirst({
      where: { OR: [{ audiusTrackId: artistCoinId }, { mintAddress: mint }, { symbol }] },
    });
    if (existing) return NextResponse.json({ song: existing, existing: true });

    const song = await prisma.songToken.create({
      data: {
        mode: "live",
        isSimulated: false,
        symbol,
        mintAddress: mint,
        fakeTokenAddress: null,
        audiusTrackId: artistCoinId,
        title: `${artistName} Artist Coin`,
        artistName,
        coinName: name,
        artistWalletId: artist.user.id,
        artworkUrl: artistUser.audiusAvatar,
        streamUrl: null,
        supply: OPEN_AUDIO_ARTIST_SUPPLY,
        circulating: 0,
        reserveSol: 0,
        curveSlope: 0,
        basePrice: 0,
        performance: 1,
        price: 0,
        marketCap: 0,
        distributor: "Open Audio / Audius Artist Coin",
        royaltyVault: "admin@song-daq.com",
        status: "LIVE",
        liquidityTokenAmount: OPEN_AUDIO_ARTIST_SUPPLY * (OPEN_AUDIO_PUBLIC_CURVE_BPS / 10_000),
        liquidityPairAmount: Number(body.initialBuyAmountAudio || 0),
        liquidityPairAsset: "AUDIO",
        liquidityLockDays: 365 * 5,
        liquidityLocked: true,
        liquidityHealth: 80,
        maxWalletBps: 1000,
        artistAllocationBps: OPEN_AUDIO_ARTIST_VESTING_BPS,
        royaltyStatus: "PENDING",
        royaltyVerificationStatus: "not_submitted",
        royaltyBacked: false,
        riskLevel: "OPEN_AUDIO_STANDARD",
      },
    });

    await prisma.transaction.create({
      data: {
        mode: "live",
        isSimulated: false,
        transactionSignature: signature,
        userId: artist.user.id,
        walletAddress: wallet,
        coinId: song.id,
        action: "Launch Open Audio Artist Coin",
        tokenAmount: OPEN_AUDIO_ARTIST_SUPPLY,
        status: "confirmed",
      },
    }).catch(() => {});

    await prisma.marketEvent.create({
      data: {
        songId: song.id,
        kind: "OPEN_AUDIO_ARTIST_COIN_LAUNCH",
        payload: JSON.stringify({
          mint,
          poolAddress,
          quoteMint: AUDIO_MINT.toBase58(),
          signature,
          supply: OPEN_AUDIO_ARTIST_SUPPLY,
          decimals: OPEN_AUDIO_ARTIST_DECIMALS,
          initialMarketCapAudio: OPEN_AUDIO_INITIAL_MARKET_CAP_AUDIO,
          graduationMarketCapAudio: OPEN_AUDIO_GRADUATION_MARKET_CAP_AUDIO,
          artistVestingBps: OPEN_AUDIO_ARTIST_VESTING_BPS,
          publicCurveBps: OPEN_AUDIO_PUBLIC_CURVE_BPS,
          lockedAmmLiquidityBps: OPEN_AUDIO_LOCKED_AMM_LIQUIDITY_BPS,
          rewardPoolBps: OPEN_AUDIO_REWARD_POOL_BPS,
        }),
      },
    }).catch(() => {});

    return NextResponse.json({ song });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to record Open Audio Artist Coin launch" }, { status: 500 });
  }
}
