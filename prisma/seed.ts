/**
 * Seed script — creates a couple of demo songs from Audius trending so
 * you can see the UI without launching anything yourself. Safe to run
 * repeatedly: it skips tracks that are already tokenized.
 */

import { PrismaClient } from "@prisma/client";
import { trendingTracks, pickArtwork, streamUrl } from "../src/lib/audius";
import { computePerformance } from "../src/lib/pricing";
import { spotPrice } from "../src/lib/bondingCurve";

const prisma = new PrismaClient();

async function main() {
  const tracks = await trendingTracks(6).catch(() => []);
  if (!tracks.length) {
    console.log("No Audius tracks available — skipping seed.");
    return;
  }
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    const exists = await prisma.songToken.findUnique({ where: { audiusTrackId: t.id } });
    if (exists) continue;
    const wallet = `Demo${(i + 1).toString().padStart(2, "0")}` + "1".repeat(40);
    const user = await prisma.user.upsert({
      where: { wallet },
      update: {},
      create: { wallet, walletType: "solana" },
    });
    const performance = computePerformance({
      streams: t.play_count ?? 0,
      likes: t.favorite_count ?? 0,
      reposts: t.repost_count ?? 0,
      volume24h: 0,
      hoursSinceLaunch: 24,
    });
    const params = { basePrice: 0.001, slope: 0.0000005, circulating: 0, performance };
    const price = spotPrice(params);
    const symbol = `$SONG-${(i + 1).toString().padStart(3, "0")}`;
    const stream = await streamUrl(t.id).catch(() => undefined);
    await prisma.songToken.create({
      data: {
        symbol,
        mintAddress: `MOCK${symbol.replace(/[^A-Z0-9]/g, "")}${"0".repeat(20)}`.slice(0, 44),
        audiusTrackId: t.id,
        title: t.title,
        artistName: t.user?.name ?? t.user?.handle ?? "Unknown",
        artistWalletId: user.id,
        artworkUrl: pickArtwork(t),
        streamUrl: stream,
        supply: 1_000_000,
        basePrice: 0.001,
        curveSlope: 0.0000005,
        artistShareBps: 5000,
        holderShareBps: 3000,
        protocolShareBps: 2000,
        streams: t.play_count ?? 0,
        likes: t.favorite_count ?? 0,
        reposts: t.repost_count ?? 0,
        performance,
        price,
      },
    });
    console.log(`Seeded ${symbol} — ${t.title}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
