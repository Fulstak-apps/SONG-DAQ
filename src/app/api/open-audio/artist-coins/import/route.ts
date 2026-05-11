import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireArtist, AuthError } from "@/lib/auth";
import { databaseReadiness } from "@/lib/appMode";
import { getCoin, hydrateArtists } from "@/lib/audiusCoins";
import { isValidPubkey } from "@/lib/solana";
import {
  AUDIO_MINT,
  OPEN_AUDIO_ARTIST_DECIMALS,
  OPEN_AUDIO_ARTIST_SUPPLY,
  OPEN_AUDIO_ARTIST_VESTING_BPS,
  OPEN_AUDIO_PUBLIC_CURVE_BPS,
  sanitizeArtistCoinName,
  sanitizeArtistCoinSymbol,
} from "@/lib/openAudioArtistCoins";

export const dynamic = "force-dynamic";

function cleanUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function uniqueSymbol(base: string, mint: string, existingId?: string) {
  const normalized = `$${sanitizeArtistCoinSymbol(base || mint.slice(0, 6))}`;
  const taken = await prisma.songToken.findUnique({ where: { symbol: normalized } }).catch(() => null);
  if (!taken || taken.id === existingId || taken.mintAddress === mint) return normalized;
  return `$${sanitizeArtistCoinSymbol(`${base || "ART"}${mint.slice(0, 3)}`)}`;
}

export async function POST(req: NextRequest) {
  try {
    const database = databaseReadiness();
    if (!database.productionReady) {
      return NextResponse.json(
        { error: "Artist Coin import needs the production database.", recommendation: database.recommendation },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const wallet = String(body.wallet || "");
    const mint = String(body.mint || "").trim();
    if (!isValidPubkey(wallet)) return NextResponse.json({ error: "Valid artist Solana wallet required" }, { status: 422 });
    if (!isValidPubkey(mint)) return NextResponse.json({ error: "Paste the official Audius/Open Audio coin mint address." }, { status: 422 });

    const artist = await requireArtist(wallet);
    const artistUser = artist.user as any;
    const listedCoin = await getCoin(mint).catch(() => null);
    const [hydratedCoin] = listedCoin ? await hydrateArtists([listedCoin]).catch(() => [listedCoin]) : [null];
    if (
      hydratedCoin?.owner_id &&
      artist.user.audiusUserId &&
      String(hydratedCoin.owner_id) !== String(artist.user.audiusUserId)
    ) {
      return NextResponse.json(
        { error: "This Audius Artist Coin belongs to a different Audius account." },
        { status: 403 },
      );
    }

    const artistName = String(
      body.artistName ||
      hydratedCoin?.artist_name ||
      artistUser.audiusName ||
      artistUser.name ||
      artist.user.audiusHandle ||
      "Artist",
    ).replace(/\s+/g, " ").trim();
    const baseSymbol = String(body.symbol || hydratedCoin?.ticker || artist.user.audiusHandle || artistName);
    const rawCoinName = String(body.name || hydratedCoin?.name || "").replace(/\s+/g, " ").trim();
    const coinName = rawCoinName ? rawCoinName.slice(0, 32) : sanitizeArtistCoinName(artistName);
    const artistCoinId = `artist-coin:${artist.user.audiusUserId || artist.user.wallet}`;

    const existing = await prisma.songToken.findFirst({
      where: { OR: [{ mintAddress: mint }, { audiusTrackId: artistCoinId }] },
    });
    const symbol = await uniqueSymbol(baseSymbol, mint, existing?.id);
    const artworkUrl = hydratedCoin?.artist_avatar || hydratedCoin?.logo_uri || cleanUrl(body.imageUrl) || artistUser.audiusAvatar || null;
    const audiusUrl = hydratedCoin?.artist_handle
      ? `https://audius.co/${hydratedCoin.artist_handle}`
      : cleanUrl(body.audiusUrl);
    const marketCap = Number(hydratedCoin?.marketCap || 0);
    const price = Number(hydratedCoin?.price || 0);
    const volume24h = Number(hydratedCoin?.v24hUSD || hydratedCoin?.v24h || 0);
    const liquidity = Number(hydratedCoin?.liquidity || 0);
    const circulating = Number(hydratedCoin?.circulatingSupply || 0);
    const riskLevel = listedCoin ? "OPEN_AUDIO_IMPORTED" : "OPEN_AUDIO_IMPORT_PENDING_INDEX";

    const song = existing
      ? await prisma.songToken.update({
          where: { id: existing.id },
          data: {
            mode: "live",
            isSimulated: false,
            symbol,
            mintAddress: mint,
            title: `${artistName} Artist Coin`,
            artistName,
            coinName,
            artworkUrl,
            streamUrl: audiusUrl,
            supply: Number(hydratedCoin?.totalSupply || OPEN_AUDIO_ARTIST_SUPPLY),
            circulating,
            price,
            marketCap,
            marketCapUsd: marketCap,
            currentPriceUsd: price,
            volume24h,
            distributor: "Open Audio / Audius Artist Coin",
            royaltyVault: "admin@song-daq.com",
            status: "LIVE",
            liquidityTokenAmount: OPEN_AUDIO_ARTIST_SUPPLY * (OPEN_AUDIO_PUBLIC_CURVE_BPS / 10_000),
            liquidityPairAmount: liquidity,
            liquidityPairAsset: "AUDIO",
            liquidityLockDays: 365 * 5,
            liquidityLocked: true,
            liquidityHealth: liquidity > 0 ? 85 : 55,
            maxWalletBps: 1000,
            artistAllocationBps: OPEN_AUDIO_ARTIST_VESTING_BPS,
            royaltyStatus: "PENDING",
            riskLevel,
          },
        })
      : await prisma.songToken.create({
          data: {
            mode: "live",
            isSimulated: false,
            symbol,
            mintAddress: mint,
            fakeTokenAddress: null,
            audiusTrackId: artistCoinId,
            title: `${artistName} Artist Coin`,
            artistName,
            coinName,
            artistWalletId: artist.user.id,
            artworkUrl,
            streamUrl: audiusUrl,
            supply: Number(hydratedCoin?.totalSupply || OPEN_AUDIO_ARTIST_SUPPLY),
            circulating,
            reserveSol: 0,
            curveSlope: 0,
            basePrice: 0,
            performance: 1,
            price,
            volume24h,
            marketCap,
            currentPriceUsd: price,
            marketCapUsd: marketCap,
            distributor: "Open Audio / Audius Artist Coin",
            royaltyVault: "admin@song-daq.com",
            status: "LIVE",
            liquidityTokenAmount: OPEN_AUDIO_ARTIST_SUPPLY * (OPEN_AUDIO_PUBLIC_CURVE_BPS / 10_000),
            liquidityPairAmount: liquidity,
            liquidityPairAsset: "AUDIO",
            liquidityLockDays: 365 * 5,
            liquidityLocked: true,
            liquidityHealth: liquidity > 0 ? 85 : 55,
            maxWalletBps: 1000,
            artistAllocationBps: OPEN_AUDIO_ARTIST_VESTING_BPS,
            royaltyStatus: "PENDING",
            royaltyVerificationStatus: "not_submitted",
            royaltyBacked: false,
            riskLevel,
          },
        });

    await prisma.transaction.create({
      data: {
        mode: "live",
        isSimulated: false,
        userId: artist.user.id,
        walletAddress: wallet,
        coinId: song.id,
        action: existing ? "Refresh Imported Audius Artist Coin" : "Import Audius Artist Coin",
        tokenAmount: Number(hydratedCoin?.totalSupply || OPEN_AUDIO_ARTIST_SUPPLY),
        usdAmount: marketCap || undefined,
        status: "confirmed",
      },
    }).catch(() => {});

    await prisma.marketEvent.create({
      data: {
        songId: song.id,
        kind: "OPEN_AUDIO_ARTIST_COIN_IMPORTED",
        payload: JSON.stringify({
          mint,
          quoteMint: AUDIO_MINT.toBase58(),
          decimals: Number(hydratedCoin?.decimals || OPEN_AUDIO_ARTIST_DECIMALS),
          source: listedCoin ? "audius-public-coins-api" : "artist-entered-mint",
          audiusUrl,
          refreshedExisting: !!existing,
        }),
      },
    }).catch(() => {});

    return NextResponse.json({
      song,
      coin: hydratedCoin,
      launch: {
        mintTx: "Imported from Audius/Open Audio",
        metadataUri: audiusUrl,
        poolAddress: null,
        quoteMint: AUDIO_MINT.toBase58(),
        tradingStatus: "LIVE",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to import Audius Artist Coin" }, { status: 500 });
  }
}
