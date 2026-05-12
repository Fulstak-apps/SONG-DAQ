import { NextRequest, NextResponse } from "next/server";
import { NETWORK, RPC_URL } from "@/lib/solana";
import { databaseReadiness } from "@/lib/appMode";

export const dynamic = "force-dynamic";

function envOn(name: string) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

export async function GET(req: NextRequest) {
  const treasuryWallet = process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET;
  const databaseUrl = process.env.DATABASE_URL || "";
  const origin = req.nextUrl.origin;
  const localAppUrl = origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
  const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || localAppUrl);
  const database = databaseReadiness(databaseUrl);
  const missing: string[] = [];
  if (!database.productionReady) missing.push("DATABASE_URL");
  if (!process.env.NEXT_PUBLIC_SOLANA_NETWORK) missing.push("NEXT_PUBLIC_SOLANA_NETWORK");
  if (!process.env.NEXT_PUBLIC_SOLANA_RPC) missing.push("NEXT_PUBLIC_SOLANA_RPC");
  if (!process.env.NEXT_PUBLIC_AUDIUS_API_KEY) missing.push("NEXT_PUBLIC_AUDIUS_API_KEY");
  if (!appUrlConfigured) missing.push("NEXT_PUBLIC_APP_URL");
  if (!treasuryWallet) missing.push("TREASURY_WALLET");
  if (!process.env.JUPITER_API_KEY) missing.push("JUPITER_API_KEY");
  const phantomReviewSubmitted = envOn("PHANTOM_REVIEW_SUBMITTED");
  const phantomReviewApproved = envOn("PHANTOM_REVIEW_APPROVED") || envOn("NEXT_PUBLIC_PHANTOM_REVIEW_APPROVED");
  const legalReviewApproved = envOn("LEGAL_REVIEW_APPROVED");
  const treasuryAuditApproved = envOn("TREASURY_AUTOMATION_AUDIT_APPROVED");
  const royaltyAutomationAllowed = legalReviewApproved && treasuryAuditApproved && envOn("ENABLE_AUTOMATED_ROYALTY_PAYOUTS");
  const treasuryAutomationAllowed = treasuryAuditApproved && envOn("ENABLE_TREASURY_AUTOMATION");
  const readyForPublic = missing.length === 0 && database.productionReady && NETWORK === "mainnet-beta";
  const walletTransactionsEnabled = true;
  return NextResponse.json({
    configured: Boolean(treasuryWallet),
    readyForPublic,
    missing,
    payerConfigured: Boolean(process.env.SOLANA_PAYER_SECRET),
    treasuryConfigured: Boolean(treasuryWallet),
    jupiterConfigured: Boolean(process.env.JUPITER_API_KEY),
    artistPaysLaunchFees: true,
    metadataConfigured: appUrlConfigured,
    phantomReviewSubmitted,
    phantomReviewApproved,
    phantomReviewRequired: NETWORK === "mainnet-beta" && !phantomReviewApproved,
    walletTransactionsEnabled,
    legalReviewApproved,
    treasuryAuditApproved,
    royaltyAutomationAllowed,
    treasuryAutomationAllowed,
    jupiterIndexingNote: "New pools can take time to index. song-daq should show route-waiting states instead of asking wallets to sign until Jupiter returns a live route.",
    manualRoyaltyMode: !royaltyAutomationAllowed,
    manualTreasuryMode: !treasuryAutomationAllowed,
    treasuryWallet,
    network: NETWORK,
    rpcUrl: RPC_URL,
    databaseConfigured: database.configured,
    databaseProductionConfigured: database.productionReady,
    databaseWarning: database.warning,
    databaseRecommendation: database.recommendation,
  });
}
