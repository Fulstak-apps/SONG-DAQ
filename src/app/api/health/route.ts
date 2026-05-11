import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { databaseReadiness } from "@/lib/appMode";
import { NETWORK, RPC_URL } from "@/lib/solana";

export const dynamic = "force-dynamic";

function envOn(name: string) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const database = databaseReadiness();
  let databaseConnected = false;
  let databaseError: string | null = null;

  if (database.productionReady) {
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, 2_500);
      databaseConnected = true;
    } catch (error) {
      databaseError = error instanceof Error ? error.message : "Database connection failed";
    }
  } else {
    databaseError = database.warning;
  }

  const legalApproved = envOn("LEGAL_REVIEW_APPROVED");
  const treasuryAuditApproved = envOn("TREASURY_AUTOMATION_AUDIT_APPROVED");
  const royaltyAutomationAllowed = legalApproved && treasuryAuditApproved && envOn("ENABLE_AUTOMATED_ROYALTY_PAYOUTS");
  const treasuryAutomationAllowed = treasuryAuditApproved && envOn("ENABLE_TREASURY_AUTOMATION");
  const missing = [
    !database.productionReady && "DATABASE_URL",
    !process.env.NEXT_PUBLIC_SOLANA_NETWORK && "NEXT_PUBLIC_SOLANA_NETWORK",
    !process.env.NEXT_PUBLIC_SOLANA_RPC && "NEXT_PUBLIC_SOLANA_RPC",
    !process.env.NEXT_PUBLIC_AUDIUS_API_KEY && "NEXT_PUBLIC_AUDIUS_API_KEY",
    !process.env.JUPITER_API_KEY && "JUPITER_API_KEY",
    !(process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET) && "TREASURY_WALLET",
  ].filter(Boolean);

  return NextResponse.json({
    ok: missing.length === 0 && databaseConnected,
    mode: process.env.APP_MODE || process.env.NEXT_PUBLIC_APP_MODE || "auto",
    network: NETWORK,
    rpcConfigured: Boolean(RPC_URL),
    database: {
      configured: database.configured,
      productionReady: database.productionReady,
      connected: databaseConnected,
      warning: database.warning,
      recommendation: database.recommendation,
      error: databaseError,
    },
    walletTrust: {
      phantomReviewSubmitted: envOn("PHANTOM_REVIEW_SUBMITTED"),
      phantomReviewApproved: envOn("PHANTOM_REVIEW_APPROVED"),
    },
    automationLocks: {
      legalReviewApproved: legalApproved,
      treasuryAuditApproved,
      royaltyAutomationAllowed,
      treasuryAutomationAllowed,
      manualRoyaltyMode: !royaltyAutomationAllowed,
      manualTreasuryMode: !treasuryAutomationAllowed,
    },
    missing,
    checkedAt: new Date().toISOString(),
  });
}
