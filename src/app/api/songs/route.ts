import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSongMint } from "@/lib/solana";
import { getTrack, pickArtwork, streamUrl } from "@/lib/audius";
import { computePerformance } from "@/lib/pricing";
import { spotPrice } from "@/lib/bondingCurve";
import { validateRoyalty, DEFAULT_ROYALTY } from "@/lib/royaltyConfig";
import { assertAudiusTrackOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sort = sp.get("sort") ?? "trending";
  const segment = sp.get("segment"); // rising | viral | liquidity | volatility | new
  const orderBy =
    sort === "gainers" ? [{ performance: "desc" as const }]
    : sort === "volume" ? [{ volume24h: "desc" as const }]
    : sort === "new" ? [{ createdAt: "desc" as const }]
    : [{ marketCap: "desc" as const }];
  let where: any = undefined;
  // Market segments are syntactic sugar over the same fields.
  if (segment === "rising") where = { performance: { gt: 1.5 } };
  else if (segment === "viral") where = { streams: { gt: 0 } };
  else if (segment === "liquidity") where = { reserveSol: { gt: 0 } };
  else if (segment === "volatility") where = { volume24h: { gt: 0 } };
  else if (segment === "new") where = { createdAt: { gt: new Date(Date.now() - 7 * 86400_000) } };

  const songs = await prisma.songToken.findMany({
    where,
    orderBy,
    take: 50,
    include: { artistWallet: { select: { wallet: true, handle: true, audiusHandle: true, audiusVerified: true } } },
  });
  return NextResponse.json({ songs });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    audiusTrackId,
    artistWallet,
    walletType = "solana",
    supply = 1_000_000,
    basePrice = 0.001,
    curveSlope = 0.0000005,
    royalty,
    symbol,
    distributor,
  } = body ?? {};

  if (!audiusTrackId) return NextResponse.json({ error: "audiusTrackId required" }, { status: 400 });
  if (!artistWallet) return NextResponse.json({ error: "artistWallet required" }, { status: 400 });

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
  if (existing) return NextResponse.json({ error: "Song already tokenized", song: existing }, { status: 409 });

  const track = await getTrack(String(audiusTrackId));
  const stream = await streamUrl(String(audiusTrackId));
  const artwork = pickArtwork(track);

  const count = await prisma.songToken.count();
  const sym = (symbol && String(symbol).startsWith("$") ? symbol : `$COIN-${String(count + 1).padStart(3, "0")}`).toUpperCase();
  const rawSym = sym.replace("$", "").toLowerCase();
  const royaltyVault = `${rawSym}@songdaq.io`;

  const { mint, mock } = await createSongMint();

  const performance = computePerformance({
    streams: track.play_count ?? 0,
    likes: track.favorite_count ?? 0,
    reposts: track.repost_count ?? 0,
    volume24h: 0,
    hoursSinceLaunch: 1,
  });
  const price = spotPrice({ basePrice, slope: curveSlope, circulating: 0, performance });

  const song = await prisma.songToken.create({
    data: {
      symbol: sym,
      mintAddress: mint,
      audiusTrackId: String(audiusTrackId),
      title: track.title,
      artistName: track.user?.name ?? track.user?.handle ?? "Unknown Artist",
      artistWalletId: user.id,
      artworkUrl: artwork,
      streamUrl: stream,
      supply: Number(supply),
      basePrice: Number(basePrice),
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
      ath: price,
      athAt: new Date(),
      distributor: distributor ? String(distributor) : null,
      royaltyVault,
      splitsLocked: false,
    },
  });
  await prisma.marketEvent.create({
    data: { songId: song.id, kind: "LAUNCH", payload: JSON.stringify({ mint, mock, symbol: sym }) },
  });
  await prisma.socialPost.create({
    data: {
      userId: user.id,
      songId: song.id,
      kind: "LAUNCH",
      text: `🚀 Listed ${sym} — ${track.title} now trading`,
    },
  });
  return NextResponse.json({ song, mintMock: mock });
}
