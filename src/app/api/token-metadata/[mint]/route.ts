import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { databaseReadiness } from "@/lib/appMode";

export const dynamic = "force-dynamic";

function appUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  ).replace(/\/$/, "");
}

function validMint(mint: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
}

function fallbackMetadata(req: NextRequest, mint: string) {
  const base = appUrl(req);
  return NextResponse.json(
    {
      name: "song-daq Song Coin",
      symbol: "SONG",
      description: "song-daq token metadata is being indexed. This is a song-linked market token. Fans buy from a public curve or liquidity pool after liquidity is verified; artist allocation and royalty verification are tracked separately.",
      image: `${base}/api/token-image/${mint}`,
      external_url: `${base}/market`,
      seller_fee_basis_points: 0,
      properties: {
        category: "image",
        files: [{ uri: `${base}/api/token-image/${mint}`, type: "image/svg+xml" }],
        creators: [],
      },
      attributes: [
        { trait_type: "Protocol", value: "song-daq" },
        { trait_type: "Asset Type", value: "Song Coin" },
        { trait_type: "Status", value: "Indexing" },
        { trait_type: "Mint Policy", value: "Fixed supply" },
        { trait_type: "Freeze Policy", value: "Disabled" },
        { trait_type: "Trading Policy", value: "Requires verified liquidity" },
        { trait_type: "Royalty Policy", value: "Admin verified separately" },
        { trait_type: "Fan Purchase Model", value: "Public curve or liquidity pool" },
        { trait_type: "Artist Allocation", value: "Separate vesting allocation" },
      ],
    },
    { headers: { "cache-control": "public, max-age=60, s-maxage=60" } },
  );
}

function canUseDatabaseMetadata() {
  return databaseReadiness().productionReady;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(id));
  });
}

export async function GET(req: NextRequest, { params }: { params: { mint: string } }) {
  const mint = params.mint;
  if (!validMint(mint)) {
    return NextResponse.json({ error: "invalid mint" }, { status: 400 });
  }

  const song = canUseDatabaseMetadata()
    ? await withTimeout(prisma.songToken.findUnique({
        where: { mintAddress: mint },
        include: {
          artistWallet: {
            select: {
              audiusHandle: true,
              audiusName: true,
              audiusVerified: true,
              wallet: true,
            },
          },
        },
      }), 1_500, null).catch(() => null)
    : null;

  if (!song) {
    return fallbackMetadata(req, mint);
  }

  const base = appUrl(req);
  const handle = song.artistWallet.audiusHandle;
  const artistName = song.artistName || song.artistWallet.audiusName || "Verified Artist";
  const symbol = song.symbol.replace(/^\$/, "").slice(0, 10).toUpperCase();
  const songUrl = `${base}/song/${song.id}`;
  const audiusUrl = handle ? `https://audius.co/${handle}` : undefined;

  return NextResponse.json(
    {
      name: `${song.title} Song Coin`.slice(0, 32),
      symbol,
      description: [
        `${song.title} by ${artistName}.`,
        "Created through song-daq as a song-linked market token.",
        "Buying this token does not automatically grant copyright ownership or guaranteed royalty rights unless separately stated in verified legal terms.",
      ].join(" "),
      image: song.artworkUrl || `${base}/api/token-image/${mint}`,
      external_url: songUrl,
      animation_url: song.streamUrl || undefined,
      seller_fee_basis_points: 0,
      properties: {
        category: "audio",
        files: [
          ...(song.artworkUrl ? [{ uri: song.artworkUrl, type: "image/jpeg" }] : []),
          ...(song.streamUrl ? [{ uri: song.streamUrl, type: "audio/mpeg" }] : []),
        ],
        creators: [
          {
            address: song.artistWallet.wallet,
            share: 100,
            verified: Boolean(song.artistWallet.audiusVerified),
          },
        ],
      },
      attributes: [
        { trait_type: "Protocol", value: "song-daq" },
        { trait_type: "Asset Type", value: "Song Coin" },
        { trait_type: "Song Title", value: song.title },
        { trait_type: "Artist", value: artistName },
        { trait_type: "Artist Wallet", value: song.artistWallet.wallet },
        { trait_type: "Audius Verified", value: song.artistWallet.audiusVerified ? "Yes" : "No" },
        { trait_type: "Audius Source", value: audiusUrl || "Pending" },
        { trait_type: "Total Supply", value: String(song.supply) },
        { trait_type: "Public Market Model", value: "Curve / liquidity pool" },
        { trait_type: "Artist Allocation", value: `${(song.artistAllocationBps / 100).toFixed(2)}% target vesting` },
        { trait_type: "Max Wallet Cap", value: `${(song.maxWalletBps / 100).toFixed(2)}%` },
        { trait_type: "Mint Policy", value: "Fixed supply" },
        { trait_type: "Mint Authority", value: "Revoked at launch" },
        { trait_type: "Freeze Authority", value: "Disabled" },
        { trait_type: "Metadata Policy", value: "Immutable after launch" },
        { trait_type: "Liquidity Status", value: song.status === "LIVE" && song.liquidityLocked ? "Verified launch liquidity" : song.liquidityPairAmount > 0 ? "Reserved liquidity pending verification" : "Pending liquidity" },
        { trait_type: "Liquidity Pair", value: `${song.liquidityPairAmount || 0} ${song.liquidityPairAsset || "SOL"}` },
        { trait_type: "Trading Status", value: song.status === "LIVE" ? "Open" : "Locked until liquidity verification" },
        { trait_type: "Royalty Status", value: song.royaltyStatus },
        { trait_type: "Royalty Verification", value: song.royaltyVerificationStatus },
        { trait_type: "Risk Label", value: song.riskLevel },
      ],
      links: {
        songdaq: songUrl,
        audius: audiusUrl,
      },
    },
    { headers: { "cache-control": "public, max-age=300, s-maxage=300" } },
  );
}
