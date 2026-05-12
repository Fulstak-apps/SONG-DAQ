import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NETWORK, RPC_URL } from "@/lib/solana";
import { databaseReadiness } from "@/lib/appMode";
import { requireAdmin } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/adminSession";
import { buildSongAssetState } from "@/lib/assetState";
import { getAssetUsdRates, normalizeAsset } from "@/lib/serverAssetPrices";

export const dynamic = "force-dynamic";

function withDashboardTimeout<T>(promise: Promise<T>, ms = 5_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Database dashboard query timed out")), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(id));
  });
}

function systemStatus(databaseConnected = false) {
  const databaseUrl = process.env.DATABASE_URL || "";
  const database = databaseReadiness(databaseUrl);
  const envOn = (name: string) => ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
  const phantomReviewSubmitted = envOn("PHANTOM_REVIEW_SUBMITTED");
  const phantomReviewApproved = envOn("PHANTOM_REVIEW_APPROVED") || envOn("NEXT_PUBLIC_PHANTOM_REVIEW_APPROVED");
  const legalReviewApproved = envOn("LEGAL_REVIEW_APPROVED");
  const treasuryAuditApproved = envOn("TREASURY_AUTOMATION_AUDIT_APPROVED");
  const royaltyAutomationAllowed = legalReviewApproved && treasuryAuditApproved && envOn("ENABLE_AUTOMATED_ROYALTY_PAYOUTS");
  const treasuryAutomationAllowed = treasuryAuditApproved && envOn("ENABLE_TREASURY_AUTOMATION");
  return {
    readyForPublic: Boolean(
      database.productionReady &&
        process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" &&
        process.env.NEXT_PUBLIC_SOLANA_RPC &&
        process.env.NEXT_PUBLIC_AUDIUS_API_KEY &&
        (process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET) &&
        process.env.JUPITER_API_KEY,
    ),
    network: NETWORK,
    rpcUrl: RPC_URL,
    treasuryWallet: process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET || null,
    payerConfigured: Boolean(process.env.SOLANA_PAYER_SECRET),
    jupiterConfigured: Boolean(process.env.JUPITER_API_KEY),
    audiusConfigured: Boolean(process.env.NEXT_PUBLIC_AUDIUS_API_KEY),
    databaseConfigured: database.configured,
    databaseLocalFallback: Boolean(database.warning?.includes("local database")),
    databaseProductionConfigured: database.productionReady,
    databaseWarning: database.warning,
    databaseRecommendation: database.recommendation,
    databaseConnected,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || null,
    phantomReviewSubmitted,
    phantomReviewApproved,
    legalReviewApproved,
    treasuryAuditApproved,
    royaltyAutomationAllowed,
    treasuryAutomationAllowed,
    manualRoyaltyMode: !royaltyAutomationAllowed,
    manualTreasuryMode: !treasuryAutomationAllowed,
  };
}

function emptyDashboard(error?: string) {
  return {
    summary: {
      openReports: 0,
      reviewedReports: 0,
      totalTokens: 0,
      liveTokens: 0,
      pendingLiquidity: 0,
      lockedRoyalties: 0,
      lockedSplits: 0,
      artists: 0,
      admins: 0,
      lowLiquidityTokens: 0,
      pendingRoyaltyRequests: 0,
      royaltyPaymentsAwaitingPool: 0,
      royaltiesReceivedUsd: 0,
      royaltyPoolContributionsUsd: 0,
      paperTransactions: 0,
      liveTransactions: 0,
      devnetTransactions: 0,
      unresolvedErrors: 0,
    },
    reports: [],
    launches: [],
    users: [],
    recentTrades: [],
    recentCoinTrades: [],
    events: [],
    topRisk: [],
    royaltyRequests: [],
    royaltyPayments: [],
    royaltyContributions: [],
    assetSyncHealth: [],
    transactions: [],
    errorLogs: error ? [{ id: "database-unavailable", errorType: "DATABASE", message: error, resolved: false, createdAt: new Date().toISOString() }] : [],
    adminLogs: [],
    system: { ...systemStatus(false), databaseWarning: error || null },
  };
}

function latestDate(...values: Array<Date | string | null | undefined>) {
  const times = values
    .map((value) => {
      if (!value) return 0;
      const ts = +new Date(value);
      return Number.isFinite(ts) ? ts : 0;
    })
    .filter(Boolean);
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function latestEventByKind(events: Array<{ kind?: string | null; createdAt?: Date | string | null }> = [], pattern: RegExp) {
  return events.find((event) => pattern.test(String(event.kind || "").toUpperCase())) || null;
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!verifyAdminSession(req)) {
    if (!wallet) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
    try {
      await requireAdmin(wallet);
    } catch (e: any) {
      const status = e.status || 403;
      return NextResponse.json({ error: status === 403 ? "Admin role required" : e.message || "Admin access unavailable" }, { status });
    }
  }

  try {
  const [
    reports,
    launches,
    users,
    recentTrades,
    recentCoinTrades,
    events,
    topRisk,
    royaltyRequests,
    royaltyPayments,
    royaltyContributions,
    assetSyncRows,
    transactions,
    errorLogs,
    adminLogs,
    statusCounts,
  ] = await withDashboardTimeout(Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        song: true,
        reporter: { select: { wallet: true, handle: true, audiusHandle: true, role: true } },
      },
    }),
    prisma.songToken.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        artistWallet: { select: { wallet: true, handle: true, audiusHandle: true, audiusVerified: true, role: true } },
        _count: { select: { reports: true, trades: true, payouts: true, watchers: true, events: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { reports: true, artistTokens: true, trades: true, coinTrades: true, payouts: true, watchlist: true } },
      },
    }),
    prisma.trade.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        user: { select: { wallet: true, handle: true, audiusHandle: true } },
        song: { select: { id: true, symbol: true, title: true, status: true } },
      },
    }),
    prisma.coinTrade.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        user: { select: { wallet: true, handle: true, audiusHandle: true } },
      },
    }),
    prisma.marketEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        song: { select: { id: true, symbol: true, title: true, status: true } },
      },
    }),
    prisma.songToken.findMany({
      where: { status: { in: ["DRAFT", "PENDING_LIQUIDITY", "LIVE", "RESTRICTED", "DELISTED"] } },
      orderBy: [{ reportCount: "desc" }, { liquidityHealth: "asc" }, { createdAt: "desc" }],
      take: 15,
      include: {
        artistWallet: { select: { wallet: true, handle: true, audiusHandle: true } },
        _count: { select: { reports: true, trades: true } },
      },
    }),
    prisma.royaltyRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.royaltyPayment.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.royaltyPoolContribution.findMany({ orderBy: { executedAt: "desc" }, take: 50 }),
    prisma.songToken.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 40,
      include: {
        artistWallet: { select: { wallet: true, handle: true, audiusHandle: true, audiusName: true, audiusVerified: true } },
        events: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: { kind: true, payload: true, createdAt: true },
        },
        pricePoints: {
          orderBy: { ts: "desc" },
          take: 1,
          select: { ts: true, close: true, volume: true },
        },
        _count: { select: { trades: true, events: true, reports: true, watchers: true } },
      },
    }),
    prisma.transaction.findMany({ orderBy: { createdAt: "desc" }, take: 75 }),
    prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    Promise.all([
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.report.count({ where: { status: "REVIEWED" } }),
      prisma.songToken.count(),
      prisma.songToken.count({ where: { status: "LIVE" } }),
      prisma.songToken.count({ where: { status: "PENDING_LIQUIDITY" } }),
      prisma.songToken.count({ where: { royaltyStatus: "LOCKED" } }),
      prisma.songToken.count({ where: { splitsLocked: true } }),
      prisma.user.count({ where: { role: "ARTIST" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.songToken.count({ where: { liquidityHealth: { lt: 40 } } }),
      prisma.royaltyRequest.count({ where: { status: "in_progress" } }),
      prisma.royaltyPayment.count({ where: { status: "payment_received" } }),
      prisma.royaltyPayment.aggregate({ _sum: { receivedAmountUsd: true } }),
      prisma.royaltyPoolContribution.aggregate({ _sum: { amountUsd: true } }),
      prisma.transaction.count({ where: { mode: "paper" } }),
      prisma.transaction.count({ where: { mode: "live" } }),
      prisma.transaction.count({ where: { mode: "devnet" } }),
      prisma.errorLog.count({ where: { resolved: false } }),
    ]),
  ]));

  const [
    openReports,
    reviewedReports,
    totalTokens,
    liveTokens,
    pendingLiquidity,
    lockedRoyalties,
    lockedSplits,
    artists,
    admins,
    lowLiquidityTokens,
    pendingRoyaltyRequests,
    royaltyPaymentsAwaitingPool,
    royaltiesReceivedAggregate,
    royaltyPoolAggregate,
    paperTransactions,
    liveTransactions,
    devnetTransactions,
    unresolvedErrors,
  ] = statusCounts;

  const system = systemStatus(true);
  const assetRates = await getAssetUsdRates([
    "SOL",
    "AUDIO",
    "USDC",
    ...assetSyncRows.map((song) => song.liquidityPairAsset),
  ]);
  const assetSyncHealth = assetSyncRows.map((song) => {
    const state = buildSongAssetState(song, assetRates);
    const lastBurn = latestEventByKind(song.events, /BURN/);
    const lastLiquidity = latestEventByKind(song.events, /LIQUIDITY|POOL/);
    const lastRoyaltyEvent = latestEventByKind(song.events, /ROYALTY|SPLIT/);
    const poolStatus =
      state.liquidityUsd >= 25 && state.tradableSupply > 0
        ? "healthy"
        : state.liquidityUsd > 0 || Number(song.liquidityPairAmount || 0) > 0
          ? "thin"
          : "missing";
    const priceStatus = state.priceUsd > 0 ? "priced" : "missing";
    const syncStatus =
      priceStatus === "missing" || poolStatus === "missing"
        ? "needs_attention"
        : poolStatus === "thin" || !state.isMarketValueReliable
          ? "watch"
          : "healthy";
    const lastPriceAt = song.pricePoints?.[0]?.ts || null;
    const lastRefreshAt = latestDate(
      song.updatedAt,
      song.createdAt,
      lastPriceAt,
      song.events?.[0]?.createdAt,
      song.lastRoyaltyPaymentDate,
      song.lastRoyaltyPoolContributionDate,
      song.lastRoyaltyRedistributionDate,
    );
    const artistName = song.artistWallet?.audiusName || song.artistWallet?.audiusHandle || song.artistName;

    return {
      id: song.id,
      mintAddress: song.mintAddress,
      symbol: song.symbol,
      title: song.title,
      artistName,
      mode: song.mode,
      status: song.status,
      syncStatus,
      price: {
        status: priceStatus,
        sol: state.priceSol,
        usd: state.priceUsd,
        source: state.marketValueBasis,
        lastPriceAt: lastPriceAt ? new Date(lastPriceAt).toISOString() : null,
      },
      pool: {
        status: poolStatus,
        pairAsset: normalizeAsset(song.liquidityPairAsset || "SOL"),
        pairAmount: Number(song.liquidityPairAmount || 0),
        tokenAmount: Number(song.liquidityTokenAmount || 0),
        liquidityUsd: state.liquidityUsd,
        locked: Boolean(song.liquidityLocked),
        lockDays: song.liquidityLockDays,
        health: song.liquidityHealth,
        lastLiquidityAt: lastLiquidity?.createdAt ? new Date(lastLiquidity.createdAt).toISOString() : null,
      },
      supply: {
        total: state.totalSupply,
        circulating: state.circulatingSupply,
        publicLiquidity: state.supplyDistribution.publicLiquiditySupply,
        artistAllocation: state.supplyDistribution.artistAllocationSupply,
        reserve: state.supplyDistribution.reserveSupply,
        publicLiquidityBps: state.supplyDistribution.publicLiquidityBps,
        artistAllocationBps: state.supplyDistribution.artistAllocationBps,
        reserveBps: state.supplyDistribution.reserveBps,
      },
      burn: {
        burnedSupply: state.burnedSupply,
        burnedBps: state.supplyDistribution.burnedBps,
        lastBurnAt: lastBurn?.createdAt ? new Date(lastBurn.createdAt).toISOString() : null,
      },
      royalty: {
        status: song.royaltyVerificationStatus || song.royaltyStatus,
        backed: song.royaltyBacked,
        receivedUsd: Number(song.totalRoyaltiesReceivedUsd || 0),
        poolAddedUsd: Number(song.totalRoyaltyPoolContributionsUsd || 0),
        lastPaymentAt: song.lastRoyaltyPaymentDate ? song.lastRoyaltyPaymentDate.toISOString() : null,
        lastPoolAt: song.lastRoyaltyPoolContributionDate ? song.lastRoyaltyPoolContributionDate.toISOString() : null,
        lastEventAt: lastRoyaltyEvent?.createdAt ? new Date(lastRoyaltyEvent.createdAt).toISOString() : null,
      },
      counts: {
        trades: song._count?.trades ?? 0,
        events: song._count?.events ?? 0,
        reports: song._count?.reports ?? 0,
        watchers: song._count?.watchers ?? 0,
      },
      lastRefreshAt,
    };
  });

  return NextResponse.json({
    summary: {
      openReports,
      reviewedReports,
      totalTokens,
      liveTokens,
      pendingLiquidity,
      lockedRoyalties,
      lockedSplits,
      artists,
      admins,
      lowLiquidityTokens,
      pendingRoyaltyRequests,
      royaltyPaymentsAwaitingPool,
      royaltiesReceivedUsd: royaltiesReceivedAggregate._sum.receivedAmountUsd || 0,
      royaltyPoolContributionsUsd: royaltyPoolAggregate._sum.amountUsd || 0,
      paperTransactions,
      liveTransactions,
      devnetTransactions,
      unresolvedErrors,
    },
    reports,
    launches,
    users,
    recentTrades,
    recentCoinTrades,
    events,
    topRisk,
    royaltyRequests,
    royaltyPayments,
    royaltyContributions,
    assetSyncHealth,
    transactions,
    errorLogs,
    adminLogs,
    system,
  });
  } catch (e: any) {
    return NextResponse.json(emptyDashboard(e?.message || "Database unavailable"), { status: 200 });
  }
}
