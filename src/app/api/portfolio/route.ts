import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchJson } from "@/lib/fetchTimeout";

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
    summary: { value: 0, cost: 0, pnl: 0, royalty: 0, coinValueUsd: 0, coinCostUsd: 0 },
  });

  let databaseUnavailable = false;
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

  // The chain remains the source of truth for token balances. These rows are
  // confirmed swap indexes used for fast activity and local cost-basis views.
  const coinHoldings = user.coinHoldings;
  const coinTrades = user.coinTrades;
  const coinValueUsd = 0;
  const coinCostUsd = coinHoldings.reduce((acc, h) => acc + h.costBasis, 0);

  // Fetch Audius user tracks + wallet info
  const effectiveAudiusId = audiusUserId || user.audiusUserId;
  let audiusTracks: any[] = [];
  let audiusWallet: any = null;

  if (effectiveAudiusId) {
    // Fetch user's tracks
    try {
      const j = await fetchJson<any>(
        `${AUDIUS_API}/v1/users/${encodeURIComponent(effectiveAudiusId)}/tracks?app_name=${encodeURIComponent(APP)}`,
        { cache: "no-store" },
        5_000,
      ).catch(() => null);
      if (j) audiusTracks = j?.data ?? [];
    } catch { /* ignore */ }

    // Fetch user profile for wallet + follower info
    try {
      const j = await fetchJson<any>(
        `${AUDIUS_API}/v1/users/${encodeURIComponent(effectiveAudiusId)}?app_name=${encodeURIComponent(APP)}`,
        { cache: "no-store" },
        5_000,
      ).catch(() => null);
      const u = j?.data;
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
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    wallet,
    holdings: user.holdings,
    coinHoldings,
    audiusTracks,
    audiusWallet,
    trades: user.trades,
    coinTrades,
    payouts: user.payouts,
    summary: { value, cost, pnl: value - cost, royalty, coinValueUsd, coinCostUsd },
  });
}
