import { NextRequest, NextResponse } from "next/server";
import { listCoins, hydrateArtists, type AudiusCoin } from "@/lib/audiusCoins";
import { recordTick, getTicks } from "@/lib/coinTicks";
import { calculateCoinRisk } from "@/lib/risk/calculateCoinRisk";
import { prisma } from "@/lib/db";
import { hasProductionDatabaseUrl } from "@/lib/appMode";
import { getAssetUsdRates, valueLocalSongCoin } from "@/lib/serverAssetPrices";
import { calculateSupplyDistribution, getBurnedSupplyFromEvents } from "@/lib/supplyDistribution";

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

function parseEventPayload(event: any) {
  if (!event?.payload) return {};
  try {
    return typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
  } catch {
    return {};
  }
}

function localSongToCoin(song: any, rates: Record<string, number> = {}): AudiusCoin {
  const mint = song.mintAddress || song.fakeTokenAddress || song.id;
  const valuation = valueLocalSongCoin(song, rates);
  const supply = valuation.totalSupply;
  const burnedSupply = getBurnedSupplyFromEvents(song.events);
  const supplyDistribution = calculateSupplyDistribution({
    supply,
    circulating: valuation.circulatingSupply || song.circulating,
    liquidityTokenAmount: valuation.tradableSupply || song.liquidityTokenAmount,
    artistAllocationBps: song.artistAllocationBps,
    burnedSupply,
  });
  const isOpenAudio = String(song.distributor || "").includes("Open Audio")
    || String(song.riskLevel || "").startsWith("OPEN_AUDIO")
    || String(song.audiusTrackId || "").startsWith("artist-coin:");
  const events = Array.isArray(song.events) ? song.events : [];
  const latestLiquidityEvent = events.find((event: any) => event?.kind === "LIQUIDITY");
  const latestLaunchEvent = events.find((event: any) => event?.kind === "LAUNCH");
  const liquidityPayload = parseEventPayload(latestLiquidityEvent);
  const liquidityDetails = liquidityPayload.liquidity || liquidityPayload;
  const launchPayload = parseEventPayload(latestLaunchEvent);
  const poolId = liquidityDetails.poolId || song.fakeLiquidityPoolAddress || null;
  const now = new Date().toISOString();
  const isSimulated = Boolean(song.isSimulated || (song.fakeTokenAddress && !song.mintAddress) || song.mode === "paper");
  return {
    name: song.coinName || `${song.title} Song Coin`,
    ticker: normalizeSymbol(song.symbol || song.title || "SONG"),
    mint,
    decimals: 6,
    owner_id: song.artistWallet?.audiusUserId || song.artistWalletId || "",
    logo_uri: song.artworkUrl || song.artistWallet?.audiusAvatar || undefined,
    description: `${song.title} by ${song.artistName}. SONG·DAQ song coin.`,
    price: valuation.priceUsd || undefined,
    marketCap: valuation.marketValueUsd || undefined,
    liquidity: valuation.liquidityUsd || undefined,
    totalSupply: supply || undefined,
    circulatingSupply: valuation.circulatingSupply || undefined,
    holder: undefined,
    v24hUSD: valuation.volumeUsd,
    priceChange24hPercent: 0,
    artist_handle: song.artistWallet?.audiusHandle || song.artistWallet?.handle || undefined,
    artist_name: song.artistName,
    artist_avatar: song.artistWallet?.audiusAvatar || undefined,
    audiusVerified: Boolean(song.artistWallet?.audiusVerified),
    songDaqVerified: Boolean(song.artistWallet?.audiusVerified),
    audius_track_id: song.audiusTrackId,
    audius_track_title: song.title,
    audius_track_artwork: song.artworkUrl || undefined,
    audius_play_count: Number(song.streams || 0),
    isSongDaqLocal: !isOpenAudio,
    isOpenAudioCoin: isOpenAudio,
    isSimulated,
    source: isOpenAudio ? "open_audio" : "songdaq",
    dataSources: [
      isOpenAudio ? "open_audio" : "songdaq",
      "supabase",
      "solana",
      song.artistWallet?.audiusHandle || song.audiusTrackId ? "audius" : "",
      isSimulated ? "demo" : "",
    ].filter(Boolean) as string[],
    priceSource: valuation.basis,
    metadataSource: song.artworkUrl ? "songdaq" : song.artistWallet?.audiusAvatar ? "audius" : "demo",
    lastRefreshAt: now,
    auditTrail: [
      { label: "Song coin indexed", source: "SONG·DAQ", status: song.status || "indexed", at: song.createdAt ? new Date(song.createdAt).toISOString() : null },
      { label: "Mint", source: "Solana", status: song.mintAddress ? "on-chain" : "simulated/pending", at: song.createdAt ? new Date(song.createdAt).toISOString() : null },
      { label: "Liquidity", source: "SONG·DAQ", status: poolId ? "pool recorded" : Number(song.liquidityPairAmount || 0) > 0 ? "indexing" : "not added", at: latestLiquidityEvent?.createdAt ? new Date(latestLiquidityEvent.createdAt).toISOString() : null },
      { label: "Royalty", source: "Supabase", status: song.royaltyVerificationStatus || "not_submitted", at: song.royaltyVerifiedAt ? new Date(song.royaltyVerifiedAt).toISOString() : null },
    ],
    songId: song.id,
    mintAddress: song.mintAddress || null,
    createdAt: song.createdAt ? new Date(song.createdAt).toISOString() : undefined,
    status: song.status,
    liquidityPairAmount: Number(song.liquidityPairAmount || 0),
    liquidityTokenAmount: Number(song.liquidityTokenAmount || 0),
    liquidityLocked: Boolean(song.liquidityLocked),
    poolId,
    poolAddress: poolId,
    lpMint: liquidityDetails.lpMint || null,
    liquidityTxSig: liquidityDetails.liquidityTxSig || null,
    liquidityEventAt: latestLiquidityEvent?.createdAt ? new Date(latestLiquidityEvent.createdAt).toISOString() : null,
    ...(launchPayload?.mintTx ? { mintTx: launchPayload.mintTx } : {}),
    ...(launchPayload?.metadataUri ? { metadataUri: launchPayload.metadataUri } : {}),
    royaltyVerificationStatus: song.royaltyVerificationStatus || "not_submitted",
    royaltyBacked: Boolean(song.royaltyBacked),
    tradableSupply: valuation.tradableSupply,
    burnedSupply,
    supplyDistribution,
    fullyDilutedValue: valuation.fullyDilutedValueUsd,
    marketValueBasis: valuation.basis,
    marketValueNote: valuation.note,
    isMarketValueReliable: valuation.isMarketValueReliable,
  };
}

function withSourceMeta(c: AudiusCoin): AudiusCoin {
  const isOpenAudio = Boolean(c.isOpenAudioCoin || c.source === "open_audio" || c.source === "audius_public");
  const isSongDaq = Boolean(c.isSongDaqLocal || c.source === "songdaq" || c.songId);
  const now = new Date().toISOString();
  return {
    ...c,
    dataSources: c.dataSources?.length
      ? c.dataSources
      : [
          isSongDaq ? "songdaq" : "",
          isOpenAudio ? "open_audio" : "",
          c.artist_handle || c.audius_track_id ? "audius" : "",
          c.mint ? "solana" : "",
          c.price != null ? "jupiter" : "",
        ].filter(Boolean) as string[],
    priceSource: c.priceSource || (isSongDaq ? String((c as any).marketValueBasis || "songdaq_index") : "open_audio_index"),
    metadataSource: c.metadataSource || (c.logo_uri ? (isOpenAudio ? "audius" : "songdaq") : "demo"),
    lastRefreshAt: c.lastRefreshAt || now,
    auditTrail: c.auditTrail?.length
      ? c.auditTrail
      : [
          { label: "Market imported", source: isOpenAudio ? "Open Audio" : "SONG·DAQ", status: "indexed", at: now },
          { label: "Mint", source: "Solana", status: c.mint ? "available" : "missing", at: now },
          { label: "Price", source: c.priceSource || (isOpenAudio ? "Open Audio" : "SONG·DAQ"), status: Number(c.price || 0) > 0 ? "priced" : "not priced", at: now },
        ],
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
          audiusVerified: true,
          wallet: true,
        },
      },
      events: {
        where: { kind: { in: ["LIQUIDITY", "LAUNCH", "BURN"] } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { kind: true, payload: true, createdAt: true },
      },
    },
  }).catch(() => []);
  const rates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", ...songs.map((song) => song.liquidityPairAsset)]);
  return songs.map((song) => localSongToCoin(song, rates));
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
    const sorted = [...combined].sort((a, b) => {
      const aSourceRank = (a as any).isSongDaqLocal ? 2 : ((a as any).isOpenAudioCoin || (a as any).source === "audius_public" || (a as any).source === "open_audio") ? 1 : 0;
      const bSourceRank = (b as any).isSongDaqLocal ? 2 : ((b as any).isOpenAudioCoin || (b as any).source === "audius_public" || (b as any).source === "open_audio") ? 1 : 0;
      if (aSourceRank !== bSourceRank && sort === "new") return bSourceRank - aSourceRank;
      if (sort === "new") {
        const ad = Date.parse(String((a as any).createdAt || "")) || 0;
        const bd = Date.parse(String((b as any).createdAt || "")) || 0;
        if (ad !== bd) return bd - ad;
      }
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
      return withSourceMeta({ ...c, sparkline });
    });
    return NextResponse.json({ coins: withSparks });
  } catch (e: any) {
    return NextResponse.json({ coins: [], error: e.message }, { status: 200 });
  }
}
