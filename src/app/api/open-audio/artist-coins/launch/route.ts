import { NextRequest, NextResponse } from "next/server";
import { requireArtist, AuthError } from "@/lib/auth";
import { databaseReadiness } from "@/lib/appMode";
import { buildOpenAudioArtistCoinLaunchTransaction, openAudioArtistCoinReadiness, sanitizeArtistCoinName, sanitizeArtistCoinSymbol } from "@/lib/openAudioArtistCoins";
import { isValidPubkey } from "@/lib/solana";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(openAudioArtistCoinReadiness());
}

export async function POST(req: NextRequest) {
  try {
    const database = databaseReadiness();
    if (!database.productionReady) {
      return NextResponse.json(
        { error: "Artist Coin launch needs a reachable production database.", recommendation: database.recommendation },
        { status: 503 },
      );
    }

    const readiness = openAudioArtistCoinReadiness();
    if (!readiness.configured) {
      return NextResponse.json(
        {
          error: "Open Audio Artist Coin launch is not configured yet.",
          missing: readiness.missing,
          recommendation: "Set OPEN_AUDIO_ARTIST_COIN_CONFIG to the authorized Meteora Dynamic Bonding Curve config used for AUDIO-paired Artist Coins.",
        },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const wallet = String(body.wallet || "");
    if (!isValidPubkey(wallet)) return NextResponse.json({ error: "Valid artist Solana wallet required" }, { status: 422 });

    const artist = await requireArtist(wallet);
    const artistUser = artist.user as any;
    const artistName = String(body.artistName || artistUser.audiusName || artistUser.name || artist.user.audiusHandle || "Artist");
    const symbol = sanitizeArtistCoinSymbol(String(body.symbol || artist.user.audiusHandle || artistName));
    const name = sanitizeArtistCoinName(String(body.name || artistName));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const metadataUri = `${baseUrl.replace(/\/$/, "")}/api/open-audio/artist-metadata/${encodeURIComponent(artist.user.audiusHandle || artistUser.handle || wallet)}`;

    const launch = await buildOpenAudioArtistCoinLaunchTransaction({
      creatorWallet: wallet,
      name,
      symbol,
      metadataUri,
      initialBuyAmountAudio: Number(body.initialBuyAmountAudio || 0),
    });

    return NextResponse.json({
      ...launch,
      message: `Ready for wallet approval. This launches $${launch.symbol} as an Open Audio-style Artist Coin paired against $AUDIO on a Meteora bonding curve.`,
      warnings: [
        "Do not sign if the wallet asks for a seed phrase, private key, or blind message signature.",
        "The prompt should show a Solana transaction using Meteora Dynamic Bonding Curve and the AUDIO quote mint.",
      ],
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to prepare Open Audio Artist Coin launch" }, { status: 500 });
  }
}
