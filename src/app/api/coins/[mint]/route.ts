import { NextRequest, NextResponse } from "next/server";
import { getCoin, hydrateArtists, type AudiusCoin } from "@/lib/audiusCoins";
import { prisma } from "@/lib/db";
import { estimateSongTokenUsd, getAssetUsdRates } from "@/lib/serverAssetPrices";

export const dynamic = "force-dynamic";

function normalizeSymbol(value: string) {
  return String(value || "").replace(/^\$/, "").toUpperCase();
}

function localSongToCoin(song: any, rates: Record<string, number> = {}): AudiusCoin {
  const mint = song.mintAddress || song.fakeTokenAddress || song.id;
  const priceUsd = estimateSongTokenUsd(song, rates);
  const supply = Number(song.supply || 0);
  const marketCap = Number(song.marketCapUsd || (priceUsd > 0 ? priceUsd * supply : 0));
  const isOpenAudio = String(song.distributor || "").includes("Open Audio")
    || String(song.riskLevel || "").startsWith("OPEN_AUDIO")
    || String(song.audiusTrackId || "").startsWith("artist-coin:");
  return {
    name: song.coinName || `${song.title} Song Coin`,
    ticker: normalizeSymbol(song.symbol || song.title || "SONG"),
    mint,
    decimals: 6,
    owner_id: song.artistWallet?.audiusUserId || song.artistWalletId || "",
    logo_uri: song.artworkUrl || song.artistWallet?.audiusAvatar || undefined,
    description: `${song.title} by ${song.artistName}. song-daq song token.`,
    price: priceUsd || undefined,
    marketCap: marketCap || undefined,
    liquidity: Number(song.launchLiquidityUsd || (Number(song.liquidityPairAmount || 0) * Number(rates[String(song.liquidityPairAsset || "SOL").toUpperCase()] || 0)) || song.liquidityPairAmount || 0),
    totalSupply: supply || undefined,
    circulatingSupply: Number(song.circulating || song.supply || 0),
    holder: undefined,
    v24hUSD: Number(song.volume24h || 0),
    priceChange24hPercent: 0,
    artist_handle: song.artistWallet?.audiusHandle || song.artistWallet?.handle || undefined,
    artist_name: song.artistName,
    artist_avatar: song.artistWallet?.audiusAvatar || undefined,
    audius_track_id: song.audiusTrackId,
    audius_track_title: song.title,
    audius_track_artwork: song.artworkUrl || undefined,
    audius_play_count: Number(song.streams || 0),
    isSongDaqLocal: !isOpenAudio,
    isOpenAudioCoin: isOpenAudio,
    source: isOpenAudio ? "open_audio" : "songdaq",
    songId: song.id,
    mintAddress: song.mintAddress || null,
    createdAt: song.createdAt ? new Date(song.createdAt).toISOString() : undefined,
    status: song.status,
    liquidityPairAmount: Number(song.liquidityPairAmount || 0),
    liquidityTokenAmount: Number(song.liquidityTokenAmount || 0),
    liquidityLocked: Boolean(song.liquidityLocked),
    royaltyVerificationStatus: song.royaltyVerificationStatus || "not_submitted",
    royaltyBacked: Boolean(song.royaltyBacked),
  };
}

async function getLocalCoin(id: string) {
  const clean = normalizeSymbol(id);
  return prisma.songToken.findFirst({
    where: {
      OR: [
        { id },
        { mintAddress: id },
        { fakeTokenAddress: id },
        { symbol: clean },
        { symbol: `$${clean}` },
      ],
    },
    include: {
      artistWallet: {
        select: {
          handle: true,
          audiusUserId: true,
          audiusHandle: true,
          audiusName: true,
          audiusAvatar: true,
          audiusVerified: true,
          wallet: true,
        },
      },
    },
  }).catch(() => null);
}

export async function GET(_req: NextRequest, ctx: { params: { mint: string } }) {
  try {
    const localFirst = await getLocalCoin(ctx.params.mint);
    const rates = localFirst
      ? await getAssetUsdRates(["SOL", "AUDIO", "USDC", localFirst.liquidityPairAsset])
      : {};
    const c = await getCoin(ctx.params.mint);
    if (!c && localFirst) {
      return NextResponse.json({ coin: { ...localFirst, ...localSongToCoin(localFirst, rates) } });
    }
    if (!c) return NextResponse.json({ error: "Coin not found yet. Refresh in a moment while song-daq syncs the new mint." }, { status: 404 });
    const [enriched] = await hydrateArtists([c]);
    const local = await prisma.songToken.findFirst({
      where: {
        OR: [
          { mintAddress: ctx.params.mint },
          { fakeTokenAddress: ctx.params.mint },
          { id: ctx.params.mint },
          { symbol: String((enriched as any).ticker || "").replace(/^\$/, "") },
        ],
      },
      select: {
        id: true,
        royaltyVerificationStatus: true,
        royaltyBacked: true,
        royaltyPercentageCommitted: true,
        totalRoyaltiesReceivedUsd: true,
        totalRoyaltyPoolContributionsUsd: true,
        totalBuybacksUsd: true,
        totalLiquidityAddedUsd: true,
        totalHolderRewardsUsd: true,
        lastRoyaltyPaymentDate: true,
        lastRoyaltyPoolContributionDate: true,
        lastRoyaltyRedistributionDate: true,
        nextExpectedRoyaltyPaymentDate: true,
        mode: true,
        isSimulated: true,
        mintAddress: true,
        fakeTokenAddress: true,
        status: true,
        liquidityPairAmount: true,
        liquidityTokenAmount: true,
        liquidityLocked: true,
        artistWallet: {
          select: {
            wallet: true,
            audiusUserId: true,
            audiusHandle: true,
            audiusName: true,
          },
        },
      },
    }).catch(() => null);
    const localCoin = localFirst ? localSongToCoin(localFirst, rates) : {};
    return NextResponse.json({ coin: { ...enriched, ...localCoin, ...(local ?? {}) } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
