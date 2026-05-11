import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NETWORK, RPC_URL } from "@/lib/solana";
import { hasProductionDatabaseUrl } from "@/lib/appMode";
import { requireAdmin } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

function hasDatabaseUrl(value = process.env.DATABASE_URL || "") {
  return /^postgres(ql)?:\/\//i.test(value);
}

function isLocalDatabaseUrl(value = process.env.DATABASE_URL || "") {
  return value.includes("127.0.0.1") || value.includes("localhost");
}

function systemStatus(databaseConnected = false) {
  const databaseUrl = process.env.DATABASE_URL || "";
  const databaseUrlLooksConfigured = hasDatabaseUrl(databaseUrl) && !isLocalDatabaseUrl(databaseUrl);
  const envOn = (name: string) => ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
  const phantomReviewSubmitted = envOn("PHANTOM_REVIEW_SUBMITTED");
  const phantomReviewApproved = envOn("PHANTOM_REVIEW_APPROVED");
  const legalReviewApproved = envOn("LEGAL_REVIEW_APPROVED");
  const treasuryAuditApproved = envOn("TREASURY_AUTOMATION_AUDIT_APPROVED");
  const royaltyAutomationAllowed = legalReviewApproved && treasuryAuditApproved && envOn("ENABLE_AUTOMATED_ROYALTY_PAYOUTS");
  const treasuryAutomationAllowed = treasuryAuditApproved && envOn("ENABLE_TREASURY_AUTOMATION");
  return {
    readyForPublic: Boolean(
      hasProductionDatabaseUrl() &&
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
    databaseConfigured: databaseUrlLooksConfigured,
    databaseLocalFallback: hasDatabaseUrl(databaseUrl) && isLocalDatabaseUrl(databaseUrl),
    databaseProductionConfigured: hasProductionDatabaseUrl(databaseUrl),
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
    transactions: [],
    errorLogs: error ? [{ id: "database-unavailable", errorType: "DATABASE", message: error, resolved: false, createdAt: new Date().toISOString() }] : [],
    adminLogs: [],
    system: { ...systemStatus(false), databaseWarning: error || null },
  };
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
    transactions,
    errorLogs,
    adminLogs,
    statusCounts,
  ] = await Promise.all([
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
  ]);

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
    transactions,
    errorLogs,
    adminLogs,
    system,
  });
  } catch (e: any) {
    return NextResponse.json(emptyDashboard(e?.message || "Database unavailable"), { status: 200 });
  }
}
