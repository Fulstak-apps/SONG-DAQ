import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
  
  const user = await prisma.user.findUnique({
    where: { wallet },
    include: {
      holdings: { include: { song: true } },
      trades: { orderBy: { createdAt: "desc" }, take: 50, include: { song: { select: { symbol: true, title: true } } } },
      payouts: { orderBy: { createdAt: "desc" }, take: 50, include: { song: { select: { symbol: true, title: true } } } },
    },
  });

  if (!user) {
    return NextResponse.json({
      wallet,
      holdings: [],
      coinHoldings: [],
      trades: [],
      coinTrades: [],
      payouts: [],
      audiusTracks: [],
      audiusWallet: null,
      summary: { value: 0, cost: 0, pnl: 0, royalty: 0, coinValueUsd: 0, coinCostUsd: 0 },
    });
  }

  let value = 0;
  let cost = 0;
  for (const h of user.holdings) {
    value += h.amount * h.song.price;
    cost += h.amount * h.costBasis;
  }
  const royalty = user.payouts.reduce((acc, p) => acc + p.amount, 0);

  // coin holdings + recent trades
  const [coinHoldings, coinTrades] = await Promise.all([
    prisma.coinHolding.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
    prisma.coinTrade.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  // mark to live price
  let coinValueUsd = 0;
  let coinCostUsd = 0;
  let livePrices: Record<string, number> = {};
  if (coinHoldings.length) {
    try {
      const { listCoins } = await import("@/lib/audiusCoins");
      const all = await listCoins(200);
      livePrices = Object.fromEntries(all.map((c) => [c.mint, c.price ?? 0]));
    } catch { /* network — fall back to last known cost */ }
    for (const h of coinHoldings) {
      const px = livePrices[h.mint] ?? h.costBasis;
      coinValueUsd += h.amount * px;
      coinCostUsd += h.amount * h.costBasis;
    }
  }
  const enrichedCoinHoldings = coinHoldings.map((h) => ({ ...h, livePrice: livePrices[h.mint] ?? null }));

  // Fetch Audius user tracks + wallet info
  const effectiveAudiusId = audiusUserId || user.audiusUserId;
  let audiusTracks: any[] = [];
  let audiusWallet: any = null;

  if (effectiveAudiusId) {
    // Fetch user's tracks
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      const r = await fetch(
        `${AUDIUS_API}/v1/users/${encodeURIComponent(effectiveAudiusId)}/tracks?app_name=${encodeURIComponent(APP)}`,
        { cache: "no-store", signal: controller.signal },
      );
      clearTimeout(id);
      if (r.ok) {
        const j = await r.json();
        audiusTracks = j?.data ?? [];
      }
    } catch { /* ignore */ }

    // Fetch user profile for wallet + follower info
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      const r = await fetch(
        `${AUDIUS_API}/v1/users/${encodeURIComponent(effectiveAudiusId)}?app_name=${encodeURIComponent(APP)}`,
        { cache: "no-store", signal: controller.signal },
      );
      clearTimeout(id);
      if (r.ok) {
        const j = await r.json();
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
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    wallet,
    holdings: user.holdings,
    coinHoldings: enrichedCoinHoldings,
    audiusTracks,
    audiusWallet,
    trades: user.trades,
    coinTrades,
    payouts: user.payouts,
    summary: { value, cost, pnl: value - cost, royalty, coinValueUsd, coinCostUsd },
  });
}
