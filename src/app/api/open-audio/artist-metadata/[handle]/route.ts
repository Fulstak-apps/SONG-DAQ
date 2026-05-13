import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

export async function GET(req: NextRequest, ctx: { params: { handle: string } }) {
  const handle = decodeURIComponent(ctx.params.handle || "").replace(/^@/, "");
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { audiusHandle: handle },
        { handle },
        { wallet: handle },
      ],
    },
  }).catch(() => null);

  const artistName = user?.audiusName || user?.name || user?.audiusHandle || handle || "Artist";
  const symbol = sanitizeArtistCoinSymbol(user?.audiusHandle || handle || artistName);
  const name = sanitizeArtistCoinName(artistName);
  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const image = user?.audiusAvatar || `${origin.replace(/\/$/, "")}/api/token-image/open-audio-${encodeURIComponent(symbol)}`;

  return NextResponse.json({
    name,
    symbol,
    description: `${name} is an Open Audio-style Artist Coin launched through SONG·DAQ. It is paired against $AUDIO on a Meteora Dynamic Bonding Curve, with artist vesting and reward-pool mechanics based on the Open Audio Artist Coin standard.`,
    image,
    external_url: user?.audiusHandle ? `https://audius.co/${user.audiusHandle}` : "https://song-daq.onrender.com",
    attributes: [
      { trait_type: "Protocol", value: "Open Audio / Audius Artist Coin" },
      { trait_type: "Quote Mint", value: AUDIO_MINT.toBase58() },
      { trait_type: "Quote Asset", value: "$AUDIO" },
      { trait_type: "Total Supply", value: String(OPEN_AUDIO_ARTIST_SUPPLY) },
      { trait_type: "Decimals", value: String(OPEN_AUDIO_ARTIST_DECIMALS) },
      { trait_type: "Initial Market Cap", value: `${OPEN_AUDIO_INITIAL_MARKET_CAP_AUDIO} AUDIO` },
      { trait_type: "Graduation Market Cap", value: `${OPEN_AUDIO_GRADUATION_MARKET_CAP_AUDIO} AUDIO` },
      { trait_type: "Artist Vesting", value: `${OPEN_AUDIO_ARTIST_VESTING_BPS / 100}% over 5 years` },
      { trait_type: "Public Curve Supply", value: `${OPEN_AUDIO_PUBLIC_CURVE_BPS / 100}%` },
      { trait_type: "Locked AMM Liquidity", value: `${OPEN_AUDIO_LOCKED_AMM_LIQUIDITY_BPS / 100}%` },
      { trait_type: "Reward Pool", value: `${OPEN_AUDIO_REWARD_POOL_BPS / 100}%` },
      { trait_type: "Audius Handle", value: user?.audiusHandle ? `@${user.audiusHandle}` : "Pending" },
      { trait_type: "Audius Verified", value: user?.audiusVerified ? "Yes" : "No" },
    ],
    properties: {
      category: "image",
      files: [{ uri: image, type: "image/png" }],
      creators: user?.wallet ? [{ address: user.wallet, share: 100, verified: Boolean(user.audiusVerified) }] : [],
    },
  });
}
