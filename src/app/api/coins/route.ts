import { NextRequest, NextResponse } from "next/server";
import { listCoins, hydrateArtists, type AudiusCoin } from "@/lib/audiusCoins";
import { recordTick, getTicks } from "@/lib/coinTicks";
import { calculateCoinRisk } from "@/lib/risk/calculateCoinRisk";
import { prisma } from "@/lib/db";
import { hasProductionDatabaseUrl } from "@/lib/appMode";

export const dynamic = "force-dynamic";

function timeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(id));
  });
}

function normalizeSymbol(value: string) {
  return String(value || "").replace(/^\$/, "").toUpperCase();
}

function localSongToCoin(song: any): AudiusCoin {
  const mint = song.mintAddress || song.fakeTokenAddress || song.id;
  const priceUsd = Number(song.currentPriceUsd || song.launchPriceUsd || 0);
  const supply = Number(song.supply || 0);
  return {
    name: song.coinName || `${song.title} Song Coin`,
    ticker: normalizeSymbol(song.symbol || song.title || "SONG"),
    mint,
    decimals: 6,
    owner_id: song.artistWallet?.audiusUserId || song.artistWalletId || "",
    logo_uri: song.artworkUrl || song.artistWallet?.audiusAvatar || undefined,
    description: `${song.title} by ${song.artistName}. SONG·DAQ song token.`,
    price: priceUsd || undefined,
    marketCap: Number(song.marketCapUsd || (priceUsd > 0 ? priceUsd * supply : 0)) || undefined,
    liquidity: Number(song.launchLiquidityUsd || song.liquidityPairAmount || 0),
    totalSupply: supply || undefined,
    circulatingSupply: Number(song.circulating || song.supply || 0),
    holder: undefined,
    v24hUSD: Number(song.volume24h || 0),
    priceChange24hPercent: 0,
    artist_handle: song.artistWallet?.audiusHandle || song.artistWallet?.handle || undefined,
    artist_name: song.artistName,
    artist_avatar: song.artistWallet?.audiusAvatar || undefined,
    audius_track_id: song.audiusTrackId,
    audius_track_title: song.title,
    audius_track_artwork: song.artworkUrl || undefined,
    audius_play_count: Number(song.streams || 0),
  };
}

async function listLocalSongCoins(limit: number) {
  if (!hasProductionDatabaseUrl()) return [];
  const songs = await prisma.songToken.findMany({
    where: { mintAddress: { not: null } },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, Math.max(10, limit)),
    include: {
      artistWallet: {
        select: {
          handle: true,
          audiusUserId: true,
          audiusHandle: true,
          audiusAvatar: true,
        },
      },
    },
  }).catch(() => []);
  return songs.map(localSongToCoin);
}

export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") ?? "marketCap";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 60);
  try {
    const [coins, localCoins] = await Promise.all([
      timeout(listCoins(limit), 3_000, []),
      timeout(listLocalSongCoins(limit), 1_500, []),
    ]);
    const raw = coins.slice(0, limit);
    const enriched = raw.length ? await timeout(hydrateArtists(raw), 4_800, raw) : [];
    const byMint = new Map<string, AudiusCoin>();
    for (const c of [...localCoins, ...enriched]) {
      if (c?.mint && !byMint.has(c.mint)) byMint.set(c.mint, c);
    }
    const combined = Array.from(byMint.values()).slice(0, Math.max(limit, localCoins.length));
    for (const c of combined) {
      recordTick(c.mint, c.price ?? 0, c.v24hUSD ?? 0, (c as any).history24hPrice ?? 0);
    }
    const sorted = [...enriched].sort((a, b) => {
      const qualityA = calculateCoinRisk(a as any).score * 1000 + Number(a.liquidity ?? 0) * 0.25 + Number(a.holder ?? 0) * 4 + Number(a.v24hUSD ?? 0) * 0.002;
      const qualityB = calculateCoinRisk(b as any).score * 1000 + Number(b.liquidity ?? 0) * 0.25 + Number(b.holder ?? 0) * 4 + Number(b.v24hUSD ?? 0) * 0.002;
      switch (sort) {
        case "volume": return (b.v24h ?? 0) - (a.v24h ?? 0);
        case "gainers": return (b.priceChange24hPercent ?? 0) - (a.priceChange24hPercent ?? 0);
        case "holders": return (b.holder ?? 0) - (a.holder ?? 0);
        case "price": return (b.price ?? 0) - (a.price ?? 0);
        case "marketCap": return (b.marketCap ?? 0) - (a.marketCap ?? 0);
        default: return qualityB - qualityA;
      }
    });
    for (const local of localCoins) {
      if (!sorted.some((coin) => coin.mint === local.mint)) sorted.unshift(local);
    }
    // Down-sample the rolling tick store to ~32 points per coin so every
    // card can render a sparkline without firing a separate request.
    const withSparks = sorted.map((c) => {
      const ticks = getTicks(c.mint);
      const N = 32;
      const stride = Math.max(1, Math.floor(ticks.length / N));
      const sparkline: number[] = [];
      for (let i = 0; i < ticks.length; i += stride) sparkline.push(ticks[i].p);
      if (ticks.length && sparkline[sparkline.length - 1] !== ticks[ticks.length - 1].p) {
        sparkline.push(ticks[ticks.length - 1].p);
      }
      return { ...c, sparkline };
    });
    return NextResponse.json({ coins: withSparks });
  } catch (e: any) {
    return NextResponse.json({ coins: [], error: e.message }, { status: 200 });
  }
}
