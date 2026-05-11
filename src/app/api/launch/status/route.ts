import { NextResponse } from "next/server";
import { NETWORK, RPC_URL } from "@/lib/solana";
import { hasProductionDatabaseUrl } from "@/lib/appMode";

export const dynamic = "force-dynamic";

export async function GET() {
  const treasuryWallet = process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET;
  const databaseUrl = process.env.DATABASE_URL || "";
  const missing: string[] = [];
  if (!hasProductionDatabaseUrl(databaseUrl)) missing.push("DATABASE_URL");
  if (!process.env.NEXT_PUBLIC_SOLANA_NETWORK) missing.push("NEXT_PUBLIC_SOLANA_NETWORK");
  if (!process.env.NEXT_PUBLIC_SOLANA_RPC) missing.push("NEXT_PUBLIC_SOLANA_RPC");
  if (!process.env.NEXT_PUBLIC_AUDIUS_API_KEY) missing.push("NEXT_PUBLIC_AUDIUS_API_KEY");
  if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.RENDER_EXTERNAL_URL) missing.push("NEXT_PUBLIC_APP_URL");
  if (!treasuryWallet) missing.push("TREASURY_WALLET");
  if (!process.env.JUPITER_API_KEY) missing.push("JUPITER_API_KEY");
  const databaseConfigured = hasProductionDatabaseUrl(databaseUrl);
  const readyForPublic = missing.length === 0 && databaseConfigured && NETWORK === "mainnet-beta";
  return NextResponse.json({
    configured: Boolean(treasuryWallet),
    readyForPublic,
    missing,
    payerConfigured: Boolean(process.env.SOLANA_PAYER_SECRET),
    treasuryConfigured: Boolean(treasuryWallet),
    jupiterConfigured: Boolean(process.env.JUPITER_API_KEY),
    artistPaysLaunchFees: true,
    metadataConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL),
    treasuryWallet,
    network: NETWORK,
    rpcUrl: RPC_URL,
    databaseConfigured,
  });
}
