import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
      name: "SONG·DAQ Song Token",
      symbol: "SONG",
      description: "SONG·DAQ token metadata is being indexed. This is a fixed-supply song-linked market token. Trading opens only after launch liquidity is verified. Royalty activity is separate and must be verified by SONG·DAQ.",
      image: `${base}/api/token-image/${mint}`,
      external_url: `${base}/market`,
      properties: {
        category: "image",
        files: [{ uri: `${base}/api/token-image/${mint}`, type: "image/svg+xml" }],
      },
      attributes: [
        { trait_type: "Protocol", value: "SONG·DAQ" },
        { trait_type: "Asset Type", value: "Song Token" },
        { trait_type: "Status", value: "Indexing" },
        { trait_type: "Mint Policy", value: "Fixed supply" },
        { trait_type: "Freeze Policy", value: "Disabled" },
        { trait_type: "Trading Policy", value: "Requires verified liquidity" },
        { trait_type: "Royalty Policy", value: "Admin verified separately" },
      ],
    },
    { headers: { "cache-control": "public, max-age=60, s-maxage=60" } },
  );
}

function canUseDatabaseMetadata() {
  const url = process.env.DATABASE_URL || "";
  return !!url && !url.includes("db.ghktjraydijlsiotmmda.supabase.co:5432");
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
      name: `${song.title} Song Token`.slice(0, 32),
      symbol,
      description: [
        `${song.title} by ${artistName}.`,
        "Created through SONG·DAQ as a song-linked market token.",
        "Buying this token does not automatically grant copyright ownership or guaranteed royalty rights unless separately stated in verified legal terms.",
      ].join(" "),
      image: song.artworkUrl || `${base}/api/token-image/${mint}`,
      external_url: songUrl,
      animation_url: song.streamUrl || undefined,
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
        { trait_type: "Protocol", value: "SONG·DAQ" },
        { trait_type: "Asset Type", value: "Song Token" },
        { trait_type: "Artist", value: artistName },
        { trait_type: "Audius Verified", value: song.artistWallet.audiusVerified ? "Yes" : "No" },
        { trait_type: "Audius Source", value: audiusUrl || "Pending" },
        { trait_type: "Mint Policy", value: "Fixed supply" },
        { trait_type: "Mint Authority", value: "Revoked at launch" },
        { trait_type: "Freeze Authority", value: "Disabled" },
        { trait_type: "Metadata Policy", value: "Immutable after launch" },
        { trait_type: "Liquidity Status", value: song.status === "LIVE" && song.liquidityLocked ? "Verified launch liquidity" : song.liquidityPairAmount > 0 ? "Reserved liquidity pending verification" : "Pending liquidity" },
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
