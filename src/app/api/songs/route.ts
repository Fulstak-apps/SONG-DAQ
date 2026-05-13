import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConnection, isValidPubkey } from "@/lib/solana";
import { getTrack, pickArtwork, streamUrl } from "@/lib/audius";
import { computePerformance } from "@/lib/pricing";
import { validateRoyalty, DEFAULT_ROYALTY } from "@/lib/royaltyConfig";
import { assertAudiusTrackOwnership, AuthError } from "@/lib/auth";
import { moderateCoinText } from "@/lib/risk/contentModeration";
import { databaseReadiness } from "@/lib/appMode";
import { getAssetUsdRates } from "@/lib/serverAssetPrices";
import { buildSongAssetState, songAssetReadFields } from "@/lib/assetState";
import { PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const database = databaseReadiness();
  if (!database.productionReady) {
    return NextResponse.json({
      songs: [],
      databaseStatus: "unavailable",
      databaseWarning: database.warning,
      databaseRecommendation: database.recommendation,
    });
  }
  const sp = req.nextUrl.searchParams;
  const sort = sp.get("sort") ?? "trending";
  const segment = sp.get("segment"); // rising | viral | liquidity | volatility | new
  const owner = sp.get("owner");
  const orderBy =
    sort === "gainers" ? [{ performance: "desc" as const }]
    : sort === "volume" ? [{ volume24h: "desc" as const }]
    : sort === "new" ? [{ createdAt: "desc" as const }]
    : [{ marketCap: "desc" as const }];
  let where: any = owner && isValidPubkey(owner)
    ? { artistWallet: { wallet: owner } }
    : { status: "LIVE", liquidityPairAmount: { gt: 0 }, liquidityTokenAmount: { gt: 0 } };
  // Market segments are syntactic sugar over the same fields.
  if (!owner) {
    if (segment === "rising") where = { ...where, performance: { gt: 1.5 } };
    else if (segment === "viral") where = { ...where, streams: { gt: 0 } };
    else if (segment === "liquidity") where = { ...where, liquidityHealth: { gt: 50 } };
    else if (segment === "volatility") where = { ...where, volume24h: { gt: 0 } };
    else if (segment === "new") where = { ...where, createdAt: { gt: new Date(Date.now() - 7 * 86400_000) } };
  }

  const songs = await prisma.songToken.findMany({
    where,
    orderBy,
    take: 50,
    include: {
      artistWallet: { select: { wallet: true, handle: true, audiusHandle: true, audiusVerified: true } },
      events: { where: { kind: { in: ["LAUNCH", "BURN"] } }, select: { kind: true, payload: true }, take: 100 },
    },
  });
  const realSongs = songs
    .filter((song) => !song.events.some((e) => e.kind === "LAUNCH" && (safeParse(e.payload) as any)?.mock))
    .map(({ events, ...song }) => song);
  const eventsBySongId = new Map(songs.map((song) => [song.id, song.events]));
  const rates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", ...realSongs.map((song) => song.liquidityPairAsset)]);
  const normalizedSongs = realSongs.map((song) => {
    const events = eventsBySongId.get(song.id) ?? [];
    const state = buildSongAssetState({ ...song, events }, rates);
    return {
      ...song,
      ...songAssetReadFields(state, song),
    };
  });
  return NextResponse.json({ songs: normalizedSongs });
}

export async function POST(req: NextRequest) {
  const database = databaseReadiness();
  if (!database.productionReady) {
    return NextResponse.json(
      { error: "Coin launch needs a reachable production database.", recommendation: database.recommendation },
      { status: 503 },
    );
  }
  const body = await req.json();
  const {
    audiusTrackId,
    artistWallet,
    walletType = "solana",
    supply = 1_000_000_000,
    basePrice = 0.001,
    curveSlope = 0.0000005,
    royalty,
    symbol,
    distributor,
    liquidity,
    maxWalletBps = 200,
    artistAllocationBps = 5000,
    ownershipConfirmed = false,
    riskAcknowledged = false,
    clientMint,
  } = body ?? {};

  if (!audiusTrackId) return NextResponse.json({ error: "audiusTrackId required" }, { status: 400 });
  if (!artistWallet) return NextResponse.json({ error: "artistWallet required" }, { status: 400 });
  if (!ownershipConfirmed) return NextResponse.json({ error: "Copyright/ownership confirmation required" }, { status: 422 });
  if (!riskAcknowledged) return NextResponse.json({ error: "Risk acknowledgement required" }, { status: 422 });
  const liq = {
    tokenAmount: Number(liquidity?.tokenAmount ?? 0),
    pairAmount: Number(liquidity?.pairAmount ?? 0),
    pairAsset: String(liquidity?.pairAsset ?? "SOL").toUpperCase(),
    lockDays: Number(liquidity?.lockDays ?? 0),
  };
  if (!["SOL", "USDC", "AUDIO"].includes(liq.pairAsset)) {
    return NextResponse.json({ error: "Song Coin launch liquidity must be paired with SOL, USDC, or AUDIO." }, { status: 422 });
  }
  if (liq.tokenAmount <= 0 || liq.pairAmount <= 0 || liq.lockDays < 30) {
    return NextResponse.json({ error: "Liquidity is required before launch. This protects buyers and allows trading to start fairly." }, { status: 422 });
  }
  if (Number(maxWalletBps) <= 0 || Number(maxWalletBps) > 1000) {
    return NextResponse.json({ error: "Max wallet cap must be between 0.01% and 10%." }, { status: 422 });
  }
  if (Number(artistAllocationBps) > 5000) {
    return NextResponse.json({ error: "Artist vesting allocation is too high. Audius-style launches should keep artist allocation at or below 50%." }, { status: 422 });
  }
  const supplyNumber = Number(supply);
  const artistVestedSupply = Math.max(0, Math.round(supplyNumber * (Number(artistAllocationBps) / 10_000)));
  const launchLiquiditySupply = Math.max(0, Math.round(liq.tokenAmount));
  const reserveSupply = Math.max(0, Math.round(supplyNumber - artistVestedSupply - launchLiquiditySupply));
  if (!Number.isFinite(supplyNumber) || supplyNumber < 1000) {
    return NextResponse.json({ error: "Total supply must be at least 1,000 coins." }, { status: 422 });
  }
  if (artistVestedSupply + launchLiquiditySupply > supplyNumber) {
    return NextResponse.json({ error: "Artist hold plus launch liquidity cannot exceed total supply." }, { status: 422 });
  }
  const treasury = process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET;
  if (!treasury) return NextResponse.json({ error: "TREASURY_WALLET is required to lock launch liquidity" }, { status: 503 });

  const cfg = { ...DEFAULT_ROYALTY, ...(royalty ?? {}) };
  const v = validateRoyalty(cfg);
  if (!v.ok) return NextResponse.json({ error: "Invalid royalty config", details: v.errors }, { status: 422 });

  // Audius ownership enforcement (also promotes wallet → ARTIST role).
  let user;
  try {
    const ctx = await assertAudiusTrackOwnership(artistWallet, String(audiusTrackId));
    user = ctx.user;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const existing = await prisma.songToken.findUnique({ where: { audiusTrackId: String(audiusTrackId) } });
  if (existing) return NextResponse.json({ error: "Song already has a song coin", song: existing }, { status: 409 });

  const track = await getTrack(String(audiusTrackId));
  const moderation = moderateCoinText({
    title: track.title,
    artist: track.user?.name ?? track.user?.handle,
    verified: Boolean((user as any).audiusVerified),
  });
  if (!moderation.ok) console.warn("Coin moderation warnings", moderation.issues);
  const stream = await streamUrl(String(audiusTrackId));
  const artwork = pickArtwork(track);

  const cleanTitle = String(track.title ?? "SONG").replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase() || "SONG";
  const sym = (symbol && String(symbol).startsWith("$") ? symbol : `$${cleanTitle}`).toUpperCase();
  const royaltyVault = "admin@song-daq.com";

  let mint: string;
  let tokenAccount: string | undefined;
  let treasuryTokenAccount: string | undefined;
  let mintTx: string | undefined;
  if (!clientMint?.mint || !clientMint?.mintTx) {
    return NextResponse.json(
      { error: "Artist wallet must sign and pay for the mint transaction before launch." },
      { status: 402 },
    );
  }
  if (!isValidPubkey(String(clientMint.mint))) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 422 });
  }
  const metadataUri = clientMint.metadataUri ? String(clientMint.metadataUri) : "";
  if (!metadataUri || !metadataUri.includes(`/api/token-metadata/${clientMint.mint}`)) {
    return NextResponse.json(
      { error: "Verified token metadata URI is required before launch." },
      { status: 422 },
    );
  }
  const conn = getConnection();
  const status = await conn.getSignatureStatus(String(clientMint.mintTx), { searchTransactionHistory: true });
  const confirmation = status.value?.confirmationStatus;
  if (!status.value || (confirmation !== "confirmed" && confirmation !== "finalized")) {
    return NextResponse.json({ error: "Mint transaction is not confirmed on Solana yet" }, { status: 409 });
  }
  if (status.value.err) {
    return NextResponse.json({ error: "Mint transaction failed on Solana", details: status.value.err }, { status: 422 });
  }
  try {
    const supplyInfo = await conn.getTokenSupply(new PublicKey(String(clientMint.mint)));
    const mintedSupply = Number(supplyInfo.value.uiAmount ?? 0);
    if (mintedSupply <= 0) {
      return NextResponse.json({ error: "Mint has no verified token supply" }, { status: 422 });
    }
    if (Math.abs(mintedSupply - supplyNumber) > 0.5) {
      return NextResponse.json({ error: "Minted supply does not match launch supply", details: { mintedSupply, supply: supplyNumber } }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ error: "Could not verify SPL mint supply on Solana" }, { status: 422 });
  }
  mint = String(clientMint.mint);
  tokenAccount = clientMint.tokenAccount ? String(clientMint.tokenAccount) : undefined;
  treasuryTokenAccount = clientMint.treasuryTokenAccount ? String(clientMint.treasuryTokenAccount) : undefined;
  mintTx = String(clientMint.mintTx);

  const performance = computePerformance({
    streams: track.play_count ?? 0,
    likes: track.favorite_count ?? 0,
    reposts: track.repost_count ?? 0,
    volume24h: 0,
    hoursSinceLaunch: 1,
  });
  const rates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", liq.pairAsset]);
  const pairUsdRate = liq.pairAsset === "USDC" ? 1 : Number(rates[liq.pairAsset] || 0);
  const solUsdRate = Number(rates.SOL || 0);
  const startingPairPrice = liq.pairAmount / Math.max(liq.tokenAmount, 1);
  const startingPriceUsd = pairUsdRate > 0 ? startingPairPrice * pairUsdRate : 0;
  const startingPriceSol = liq.pairAsset === "SOL"
    ? startingPairPrice
    : startingPriceUsd > 0 && solUsdRate > 0
      ? startingPriceUsd / solUsdRate
      : Number(basePrice);
  const effectiveBasePrice = Number.isFinite(startingPriceSol) && startingPriceSol > 0
    ? startingPriceSol
    : Number(basePrice);
  // The launch price is the public pool ratio. Do not multiply the full 1B
  // supply by an arbitrary curve/performance value before liquidity confirms.
  // That made fresh coins look like they had huge cash value with no market.
  const price = effectiveBasePrice;
  const currentPriceUsd = startingPriceUsd > 0
    ? startingPriceUsd
    : solUsdRate > 0
      ? price * solUsdRate
      : 0;
  const launchLiquidityUsd = pairUsdRate > 0 ? liq.pairAmount * pairUsdRate : 0;
  const marketCapSol = 0;
  const marketCapUsd = 0;

  const song = await prisma.songToken.create({
    data: {
      symbol: sym,
      mintAddress: mint,
      coinName: `${track.title} Song Coin`,
      audiusTrackId: String(audiusTrackId),
      title: track.title,
      artistName: track.user?.name ?? track.user?.handle ?? "Unknown Artist",
      artistWalletId: user.id,
      artworkUrl: artwork,
      streamUrl: stream,
      supply: Number(supply),
      basePrice: effectiveBasePrice,
      curveSlope: Number(curveSlope),
      artistShareBps: cfg.artistShareBps,
      holderShareBps: cfg.holderShareBps,
      protocolShareBps: cfg.protocolShareBps,
      streamingEnabled: cfg.streamingEnabled,
      tradingFeesEnabled: cfg.tradingFeesEnabled,
      externalRevenueEnabled: cfg.externalRevenueEnabled,
      streams: track.play_count ?? 0,
      likes: track.favorite_count ?? 0,
      reposts: track.repost_count ?? 0,
      performance,
      price,
      launchPriceSol: effectiveBasePrice,
      launchPriceUsd: startingPriceUsd,
      currentPriceSol: price,
      currentPriceUsd,
      marketCap: marketCapSol,
      marketCapUsd,
      launchLiquiditySol: liq.pairAsset === "SOL" ? liq.pairAmount : 0,
      launchLiquidityUsd,
      ath: price,
      athAt: new Date(),
      distributor: distributor ? String(distributor) : null,
      royaltyVault,
      splitsLocked: false,
      status: "PENDING_LIQUIDITY",
      liquidityTokenAmount: liq.tokenAmount,
      liquidityPairAmount: liq.pairAmount,
      liquidityPairAsset: liq.pairAsset,
      liquidityLockDays: liq.lockDays,
      liquidityLocked: false,
      liquidityHealth: 0,
      maxWalletBps: Number(maxWalletBps),
      artistAllocationBps: Number(artistAllocationBps),
      royaltyStatus: "PENDING",
      royaltyVerificationStatus: "not_submitted",
      royaltyBacked: false,
      riskLevel: "UNVERIFIED",
    },
  });
  await prisma.transaction.create({
    data: {
      mode: "live",
      isSimulated: false,
      transactionSignature: mintTx,
      userId: user.id,
      walletAddress: artistWallet,
      coinId: song.id,
      action: "Launch",
      solAmount: liq.pairAsset === "SOL" ? liq.pairAmount : undefined,
      usdAmount: launchLiquidityUsd || undefined,
      tokenAmount: liq.tokenAmount,
      status: "pending_liquidity",
    },
  }).catch(() => {});
  await prisma.marketEvent.create({
    data: {
      songId: song.id,
      kind: "LAUNCH",
      payload: JSON.stringify({
        mint,
        tokenAccount,
        treasuryTokenAccount,
        mintTx,
        metadataAddress: clientMint.metadataAddress ? String(clientMint.metadataAddress) : null,
        metadataUri,
        paidBy: artistWallet,
        liquidity: liq,
        allocation: {
          artistVestedSupply,
          launchLiquiditySupply,
          reserveSupply,
          artistWalletMintAmount: artistVestedSupply + launchLiquiditySupply,
        },
        symbol: sym,
        walletVisibility: {
          metaplexMetadataAttached: true,
          stableMetadataUri: true,
          source: "SONG·DAQ + Audius",
          phantomMayStillHideNewTokens: true,
          openAudioModel: "Audius-style artist coins use a public $AUDIO market curve and creator vesting. SONG·DAQ opens trading after verified liquidity exists.",
        },
      }),
    },
  });
  await prisma.socialPost.create({
    data: {
      userId: user.id,
      songId: song.id,
      kind: "LAUNCH",
      text: `Launch pending ${sym} — ${track.title} minted on Solana and waiting for verified liquidity`,
    },
  });
  return NextResponse.json({
    song,
    launch: {
      mint,
      tokenAccount,
      treasuryTokenAccount,
      mintTx,
      allocation: {
        artistVestedSupply,
        launchLiquiditySupply,
        reserveSupply,
        artistWalletMintAmount: artistVestedSupply + launchLiquiditySupply,
      },
      metadataAddress: clientMint.metadataAddress ? String(clientMint.metadataAddress) : null,
      metadataUri,
      paidBy: artistWallet,
      tradingStatus: "PENDING_LIQUIDITY",
      message: "Song Coin minted. Fans buy from the public market curve/pool, not from the artist directly. Trading opens only after verified liquidity is active.",
    },
  });
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return {}; }
}
