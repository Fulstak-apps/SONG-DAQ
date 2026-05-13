import { NextRequest, NextResponse } from "next/server";
import { getCoin, hydrateArtists, type AudiusCoin } from "@/lib/audiusCoins";
import { prisma } from "@/lib/db";
import { getAssetUsdRates, valueLocalSongCoin } from "@/lib/serverAssetPrices";
import { calculateSupplyDistribution, getBurnedSupplyFromEvents } from "@/lib/supplyDistribution";

export const dynamic = "force-dynamic";

function normalizeSymbol(value: string) {
  return String(value || "").replace(/^\$/, "").toUpperCase();
}

function parseEventPayload(event: any) {
  if (!event?.payload) return {};
  try {
    return typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
  } catch {
    return {};
  }
}

function localSongToCoin(song: any, rates: Record<string, number> = {}): AudiusCoin {
  const mint = song.mintAddress || song.fakeTokenAddress || song.id;
  const valuation = valueLocalSongCoin(song, rates);
  const supply = valuation.totalSupply;
  const burnedSupply = getBurnedSupplyFromEvents(song.events);
  const supplyDistribution = calculateSupplyDistribution({
    supply,
    circulating: valuation.circulatingSupply || song.circulating,
    liquidityTokenAmount: valuation.tradableSupply || song.liquidityTokenAmount,
    artistAllocationBps: song.artistAllocationBps,
    burnedSupply,
  });
  const isOpenAudio = String(song.distributor || "").includes("Open Audio")
    || String(song.riskLevel || "").startsWith("OPEN_AUDIO")
    || String(song.audiusTrackId || "").startsWith("artist-coin:");
  const events = Array.isArray(song.events) ? song.events : [];
  const latestLiquidityEvent = events.find((event: any) => event?.kind === "LIQUIDITY");
  const latestLaunchEvent = events.find((event: any) => event?.kind === "LAUNCH");
  const liquidityPayload = parseEventPayload(latestLiquidityEvent);
  const liquidityDetails = liquidityPayload.liquidity || liquidityPayload;
  const launchPayload = parseEventPayload(latestLaunchEvent);
  const poolId = liquidityDetails.poolId || song.fakeLiquidityPoolAddress || null;
  return {
    name: song.coinName || `${song.title} Song Coin`,
    ticker: normalizeSymbol(song.symbol || song.title || "SONG"),
    mint,
    decimals: 6,
    owner_id: song.artistWallet?.audiusUserId || song.artistWalletId || "",
    logo_uri: song.artworkUrl || song.artistWallet?.audiusAvatar || undefined,
    description: `${song.title} by ${song.artistName}. SONG·DAQ song coin.`,
    price: valuation.priceUsd || undefined,
    marketCap: valuation.marketValueUsd || undefined,
    liquidity: valuation.liquidityUsd || undefined,
    totalSupply: supply || undefined,
    circulatingSupply: valuation.circulatingSupply || undefined,
    holder: undefined,
    v24hUSD: valuation.volumeUsd,
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
    poolId,
    poolAddress: poolId,
    lpMint: liquidityDetails.lpMint || null,
    liquidityTxSig: liquidityDetails.liquidityTxSig || null,
    liquidityEventAt: latestLiquidityEvent?.createdAt ? new Date(latestLiquidityEvent.createdAt).toISOString() : null,
    ...(launchPayload?.mintTx ? { mintTx: launchPayload.mintTx } : {}),
    ...(launchPayload?.metadataUri ? { metadataUri: launchPayload.metadataUri } : {}),
    royaltyVerificationStatus: song.royaltyVerificationStatus || "not_submitted",
    royaltyBacked: Boolean(song.royaltyBacked),
    tradableSupply: valuation.tradableSupply,
    burnedSupply,
    supplyDistribution,
    fullyDilutedValue: valuation.fullyDilutedValueUsd,
    marketValueBasis: valuation.basis,
    marketValueNote: valuation.note,
    isMarketValueReliable: valuation.isMarketValueReliable,
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
      events: {
        where: { kind: { in: ["LIQUIDITY", "LAUNCH", "BURN"] } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { kind: true, payload: true, createdAt: true },
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
    if (!c) return NextResponse.json({ error: "Coin not found yet. Refresh in a moment while SONG·DAQ syncs the new mint." }, { status: 404 });
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
      include: {
        artistWallet: {
          select: {
            handle: true,
            wallet: true,
            audiusUserId: true,
            audiusHandle: true,
            audiusName: true,
            audiusAvatar: true,
            audiusVerified: true,
          },
        },
        events: {
          where: { kind: { in: ["LIQUIDITY", "LAUNCH", "BURN"] } },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { kind: true, payload: true, createdAt: true },
        },
      },
    }).catch(() => null);
    const localCoin = localFirst ? localSongToCoin(localFirst, rates) : local ? localSongToCoin(local, rates) : {};
    // Keep the normalized valuation last so stale raw DB market-cap fields
    // cannot overwrite public-market-safe pricing for fresh local launches.
    return NextResponse.json({ coin: { ...enriched, ...(local ?? {}), ...localCoin } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
