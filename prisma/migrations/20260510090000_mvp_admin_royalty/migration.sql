-- Song-daq MVP admin, royalty, paper-mode, and transaction tracking layer.
-- Additive only: existing launch/trade data remains intact.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'live';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paperBalanceSol" DOUBLE PRECISION NOT NULL DEFAULT 100;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paperBalanceUsd" DOUBLE PRECISION NOT NULL DEFAULT 10000;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paperModeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "riskAcknowledged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "riskAcknowledgedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "artistRiskAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "investorRiskAcceptedAt" TIMESTAMP(3);

ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'live';
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "fakeTokenAddress" TEXT;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "coinName" TEXT;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "fakeLiquidityPoolAddress" TEXT;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "royaltyVerificationStatus" TEXT NOT NULL DEFAULT 'not_submitted';
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "royaltyBacked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "royaltyPercentageCommitted" DOUBLE PRECISION;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "royaltyRequestId" TEXT;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "royaltyVerifiedAt" TIMESTAMP(3);
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "royaltyVerifiedBy" TEXT;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "totalRoyaltiesReceivedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "totalRoyaltyPoolContributionsUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "totalBuybacksUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "totalLiquidityAddedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "totalHolderRewardsUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "launchPriceSol" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "launchPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "currentPriceSol" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "currentPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "marketCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "launchLiquiditySol" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "launchLiquidityUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "lastRoyaltyPaymentDate" TIMESTAMP(3);
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "lastRoyaltyPoolContributionDate" TIMESTAMP(3);
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "lastRoyaltyRedistributionDate" TIMESTAMP(3);
ALTER TABLE "SongToken" ADD COLUMN IF NOT EXISTS "nextExpectedRoyaltyPaymentDate" TIMESTAMP(3);

UPDATE "SongToken"
SET
  "coinName" = COALESCE("coinName", "title"),
  "currentPriceSol" = CASE WHEN "currentPriceSol" = 0 THEN "price" ELSE "currentPriceSol" END,
  "launchPriceSol" = CASE WHEN "launchPriceSol" = 0 THEN "basePrice" ELSE "launchPriceSol" END,
  "marketCapUsd" = CASE WHEN "marketCapUsd" = 0 THEN "marketCap" ELSE "marketCapUsd" END,
  "royaltyVerificationStatus" = CASE
    WHEN "royaltyStatus" IN ('LOCKED', 'VERIFIED') OR "splitsLocked" = true THEN 'verified'
    WHEN "royaltyStatus" IN ('PENDING', 'REVIEWING') THEN 'in_progress'
    WHEN "royaltyStatus" IN ('REJECTED', 'NEEDS_UPDATE') THEN 'needs_update'
    ELSE "royaltyVerificationStatus"
  END,
  "royaltyBacked" = CASE WHEN "royaltyStatus" IN ('LOCKED', 'VERIFIED') OR "splitsLocked" = true THEN true ELSE "royaltyBacked" END;

CREATE TABLE IF NOT EXISTS "RoyaltyRequest" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'live',
  "coinId" TEXT,
  "artistId" TEXT,
  "artistName" TEXT NOT NULL,
  "legalName" TEXT,
  "email" TEXT,
  "walletAddress" TEXT,
  "songTitle" TEXT NOT NULL,
  "coinToken" TEXT,
  "distributor" TEXT,
  "isrc" TEXT,
  "upc" TEXT,
  "royaltyPercentageAssigned" DOUBLE PRECISION,
  "expectedMonthlyRoyaltyAmount" DOUBLE PRECISION,
  "distributorPortalUsed" TEXT,
  "dateSplitInvitationSent" TIMESTAMP(3),
  "proofUploadUrl" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoyaltyRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RoyaltyPayment" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'live',
  "coinId" TEXT,
  "artistId" TEXT,
  "songTitle" TEXT NOT NULL,
  "monthCovered" TEXT,
  "expectedAmountUsd" DOUBLE PRECISION,
  "receivedAmountUsd" DOUBLE PRECISION NOT NULL,
  "currencyReceived" TEXT NOT NULL DEFAULT 'USD',
  "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "distributorSource" TEXT,
  "paymentProofUrl" TEXT,
  "referenceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'payment_received',
  "redistributionMethod" TEXT,
  "royaltyPoolContributionAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "buybackAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "liquidityAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "holderRewardAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "protocolReserveAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "transactionHash" TEXT,
  "fakeTransactionId" TEXT,
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoyaltyPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RoyaltyPoolContribution" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'live',
  "royaltyPaymentId" TEXT,
  "coinId" TEXT,
  "artistId" TEXT,
  "amountUsd" DOUBLE PRECISION NOT NULL,
  "amountSol" DOUBLE PRECISION,
  "amountUsdc" DOUBLE PRECISION,
  "poolAddress" TEXT,
  "transactionHash" TEXT,
  "fakeTransactionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pool_contributed',
  "executedBy" TEXT,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "RoyaltyPoolContribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RoyaltyRedistribution" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'live',
  "royaltyPaymentId" TEXT,
  "coinId" TEXT,
  "method" TEXT NOT NULL,
  "royaltyPoolContributionAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "buybackAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "liquidityAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "holderRewardAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "protocolReserveAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "solEquivalent" DOUBLE PRECISION,
  "transactionHash" TEXT,
  "fakeTransactionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'redistributed',
  "executedBy" TEXT,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "RoyaltyRedistribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'live',
  "isSimulated" BOOLEAN NOT NULL DEFAULT false,
  "fakeTransactionId" TEXT,
  "transactionSignature" TEXT,
  "userId" TEXT,
  "walletAddress" TEXT,
  "coinId" TEXT,
  "action" TEXT NOT NULL,
  "solAmount" DOUBLE PRECISION,
  "usdAmount" DOUBLE PRECISION,
  "tokenAmount" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PortfolioPosition" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'live',
  "userId" TEXT,
  "walletAddress" TEXT,
  "coinId" TEXT,
  "tokenAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "averageBuyPriceSol" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "averageBuyPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currentValueSol" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currentValueUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unrealizedGainLossUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminLog" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'live',
  "adminId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ErrorLog" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'live',
  "errorType" TEXT NOT NULL,
  "userId" TEXT,
  "walletAddress" TEXT,
  "page" TEXT,
  "message" TEXT NOT NULL,
  "stack" TEXT,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AppSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "RoyaltyRequest_coinId_createdAt_idx" ON "RoyaltyRequest"("coinId", "createdAt");
CREATE INDEX IF NOT EXISTS "RoyaltyRequest_status_createdAt_idx" ON "RoyaltyRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RoyaltyPayment_coinId_createdAt_idx" ON "RoyaltyPayment"("coinId", "createdAt");
CREATE INDEX IF NOT EXISTS "RoyaltyPayment_status_createdAt_idx" ON "RoyaltyPayment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RoyaltyPoolContribution_coinId_executedAt_idx" ON "RoyaltyPoolContribution"("coinId", "executedAt");
CREATE INDEX IF NOT EXISTS "RoyaltyPoolContribution_royaltyPaymentId_idx" ON "RoyaltyPoolContribution"("royaltyPaymentId");
CREATE INDEX IF NOT EXISTS "RoyaltyRedistribution_coinId_executedAt_idx" ON "RoyaltyRedistribution"("coinId", "executedAt");
CREATE INDEX IF NOT EXISTS "RoyaltyRedistribution_royaltyPaymentId_idx" ON "RoyaltyRedistribution"("royaltyPaymentId");
CREATE INDEX IF NOT EXISTS "Transaction_coinId_createdAt_idx" ON "Transaction"("coinId", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_walletAddress_createdAt_idx" ON "Transaction"("walletAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_mode_createdAt_idx" ON "Transaction"("mode", "createdAt");
CREATE INDEX IF NOT EXISTS "PortfolioPosition_walletAddress_mode_idx" ON "PortfolioPosition"("walletAddress", "mode");
CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioPosition_walletAddress_coinId_mode_key" ON "PortfolioPosition"("walletAddress", "coinId", "mode");
CREATE INDEX IF NOT EXISTS "AdminLog_createdAt_idx" ON "AdminLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminLog_targetType_targetId_idx" ON "AdminLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "ErrorLog_resolved_createdAt_idx" ON "ErrorLog"("resolved", "createdAt");
