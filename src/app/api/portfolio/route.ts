import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchJson } from "@/lib/fetchTimeout";
import { databaseReadiness } from "@/lib/appMode";
import { listCoins } from "@/lib/audiusCoins";
import { getAssetUsdRates, valueLocalSongCoin } from "@/lib/serverAssetPrices";

export const dynamic = "force-dynamic";

const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
// Use official API base — discoveryprovider is deprecated
const AUDIUS_API = "https://api.audius.co";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  // Also accept audius user ID for fetching Audius-specific data
  const audiusUserId = req.nextUrl.searchParams.get("audiusUserId");
  const audiusSolWallet = req.nextUrl.searchParams.get("audiusSolWallet");
  const audiusEthWallet = req.nextUrl.searchParams.get("audiusEthWallet");

  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  
  const emptyPortfolio = (databaseStatus: "connected" | "unavailable" = "connected") => ({
    wallet,
    holdings: [],
    coinHoldings: [],
    trades: [],
    coinTrades: [],
    payouts: [],
    audiusTracks: [],
    audiusWallet: null,
    databaseStatus,
    summary: { value: 0, cost: 0, pnl: 0, royalty: 0, coinValueUsd: 0, coinCostUsd: 0, coinPnlUsd: 0, songValueUsd: 0, songCostUsd: 0, songPnlUsd: 0 },
  });

  let databaseUnavailable = false;
  const database = databaseReadiness();
  if (!database.productionReady) {
    return NextResponse.json({
      ...emptyPortfolio("unavailable"),
      databaseWarning: database.warning,
      databaseRecommendation: database.recommendation,
    });
  }

  const user = await prisma.user.findUnique({
    where: { wallet },
    include: {
      holdings: { include: { song: true } },
      coinHoldings: { orderBy: { updatedAt: "desc" } },
      trades: { orderBy: { createdAt: "desc" }, take: 50, include: { song: { select: { symbol: true, title: true } } } },
      coinTrades: { orderBy: { createdAt: "desc" }, take: 50 },
      payouts: { orderBy: { createdAt: "desc" }, take: 50, include: { song: { select: { symbol: true, title: true } } } },
    },
  }).catch((e) => {
    console.error("Portfolio database unavailable", e);
    databaseUnavailable = true;
    return null;
  });

  if (!user) {
    return NextResponse.json(emptyPortfolio(databaseUnavailable ? "unavailable" : "connected"));
  }

  let value = 0;
  let cost = 0;
  for (const h of user.holdings) {
    value += h.amount * h.song.price;
    cost += h.amount * h.costBasis;
  }
  const royalty = user.payouts.reduce((acc, p) => acc + p.amount, 0);
  const solRateMap = await getAssetUsdRates(["SOL"]);
  const solUsd = Number(solRateMap.SOL || 0);
  const songValueUsd = solUsd > 0 ? value * solUsd : 0;
  const songCostUsd = solUsd > 0 ? cost * solUsd : 0;
  const songPnlUsd = songValueUsd - songCostUsd;

  // The chain remains the source of truth for token balances. These rows are
  // confirmed swap indexes used for fast activity and local cost-basis views.
  const coinHoldings = user.coinHoldings;
  const coinTrades = user.coinTrades;
  const mints = Array.from(new Set(coinHoldings.map((h) => h.mint).filter(Boolean)));
  const [publicCoins, localSongs] = await Promise.all([
    mints.length ? listCoins(100).catch(() => []) : Promise.resolve([]),
    mints.length ? prisma.songToken.findMany({
      where: {
        OR: [
          { mintAddress: { in: mints } },
          { fakeTokenAddress: { in: mints } },
          { id: { in: mints } },
        ],
      },
      include: {
        events: {
          where: { kind: { in: ["LIQUIDITY", "BURN"] } },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: { kind: true, payload: true, createdAt: true },
        },
      },
    }).catch(() => []) : Promise.resolve([]),
  ]);
  const publicMap = new Map(publicCoins.map((coin: any) => [String(coin.mint), coin]));
  const localRateMap = await getAssetUsdRates(["SOL", "AUDIO", "USDC", ...localSongs.map((song) => song.liquidityPairAsset)]);
  const localMap = new Map(localSongs.map((song: any) => {
    const valuation = valueLocalSongCoin(song, localRateMap);
    return [String(song.mintAddress || song.fakeTokenAddress || song.id), { song, valuation }];
  }));
  const pricedCoinHoldings = coinHoldings.map((h) => {
    const publicCoin: any = publicMap.get(h.mint);
    const local: any = localMap.get(h.mint);
    const priceUsd = Number(publicCoin?.price ?? local?.valuation?.priceUsd ?? 0);
    const averageBuyPriceUsd = h.amount > 0 ? h.costBasis / h.amount : 0;
    const currentValueUsd = priceUsd > 0 ? h.amount * priceUsd : h.costBasis;
    const unrealizedGainLossUsd = currentValueUsd - h.costBasis;
    return {
      ...h,
      priceUsd: priceUsd || averageBuyPriceUsd,
      averageBuyPriceUsd,
      currentValueUsd,
      unrealizedGainLossUsd,
      priceSource: priceUsd > 0 ? (local ? local.valuation.basis : "open_audio_index") : "cost_basis_fallback",
      metadataSource: local ? "SONG·DAQ" : publicCoin ? "Audius/Open Audio" : "Supabase",
    };
  });
  const coinValueUsd = pricedCoinHoldings.reduce((acc, h) => acc + Number(h.currentValueUsd || 0), 0);
  const coinCostUsd = pricedCoinHoldings.reduce((acc, h) => acc + Number(h.costBasis || 0), 0);
  const coinPnlUsd = coinValueUsd - coinCostUsd;

  // Fetch Audius user tracks + wallet info
  const effectiveAudiusId = audiusUserId || user.audiusUserId;
  let audiusTracks: any[] = [];
  let audiusWallet: any = null;

  if (effectiveAudiusId) {
    const [tracksResult, profileResult] = await Promise.allSettled([
      fetchJson<any>(
        `${AUDIUS_API}/v1/users/${encodeURIComponent(effectiveAudiusId)}/tracks?app_name=${encodeURIComponent(APP)}`,
        { cache: "no-store" },
        2_500,
      ),
      fetchJson<any>(
        `${AUDIUS_API}/v1/users/${encodeURIComponent(effectiveAudiusId)}?app_name=${encodeURIComponent(APP)}`,
        { cache: "no-store" },
        2_500,
      ),
    ]);
    if (tracksResult.status === "fulfilled") audiusTracks = tracksResult.value?.data ?? [];

    if (profileResult.status === "fulfilled") {
      const u = profileResult.value?.data;
      if (u) {
        audiusWallet = {
          userId: u.id,
          handle: u.handle,
          name: u.name,
          followers: u.follower_count ?? 0,
          following: u.followee_count ?? 0,
          trackCount: u.track_count ?? 0,
          playlistCount: u.playlist_count ?? 0,
          solWallet: audiusSolWallet || u.spl_wallet || u.splWallet || null,
          ethWallet: audiusEthWallet || u.erc_wallet || u.ercWallet || u.wallet || null,
          verified: !!u.is_verified,
          // Total play count across all tracks
          totalPlays: audiusTracks.reduce((sum: number, t: any) => sum + (t.play_count ?? 0), 0),
        };
      }
    }
  }

  return NextResponse.json({
    wallet,
    holdings: user.holdings,
    coinHoldings: pricedCoinHoldings,
    audiusTracks,
    audiusWallet,
    trades: user.trades,
    coinTrades,
    payouts: user.payouts,
    summary: {
      value,
      cost,
      pnl: songPnlUsd + coinPnlUsd,
      royalty,
      coinValueUsd,
      coinCostUsd,
      coinPnlUsd,
      songValueUsd,
      songCostUsd,
      songPnlUsd,
    },
  });
}
