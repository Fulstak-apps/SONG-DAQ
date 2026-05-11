import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hydrateArtists, listCoins } from "@/lib/audiusCoins";

export const dynamic = "force-dynamic";

export async function GET() {
  const [events, liveCoins] = await Promise.all([
    prisma.marketEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { song: { select: { symbol: true, title: true, artworkUrl: true } } },
    }).catch(() => []),
    listCoins(40).then((coins) => hydrateArtists(coins)).catch(() => []),
  ]);
  // payload is stored as a JSON string in sqlite — parse for client
  const decoded = events
    .map((e) => ({
      ...e,
      payload: safeParse(e.payload),
    }))
    .filter((e) => e.kind !== "ROYALTY" && !(e.payload as any)?.mock);
  const now = Date.now();
  const quoteEvents = liveCoins
    .filter((c) => c.mint && ((c.v24hUSD ?? 0) > 0 || Math.abs(c.priceChange24hPercent ?? 0) > 0.01 || (c.trade24h ?? 0) > 0))
    .sort((a, b) => (b.v24hUSD ?? 0) - (a.v24hUSD ?? 0))
    .slice(0, 30)
    .map((c, i) => ({
      id: `coin-${c.mint}-${Math.round(now / 60000)}`,
      kind: "MOVE",
      payload: {
        symbol: c.ticker,
        price: c.price ?? 0,
        change: c.priceChange24hPercent ?? 0,
        volumeUsd: c.v24hUSD ?? 0,
        trades: c.trade24h ?? 0,
        mint: c.mint,
        artist: c.artist_name ?? c.name,
        logo_uri: c.logo_uri ?? null,
        wallet: c.owner_id ?? null,
      },
      createdAt: new Date(now - i * 37_000).toISOString(),
      song: { symbol: c.ticker, title: c.artist_name ?? c.name, artworkUrl: c.logo_uri ?? null },
    }));
  return NextResponse.json({ events: [...quoteEvents, ...decoded].slice(0, 60) });
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return {}; }

}
