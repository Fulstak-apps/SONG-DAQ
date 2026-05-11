-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "walletType" TEXT NOT NULL DEFAULT 'solana',
    "handle" TEXT,
    "audiusUserId" TEXT,
    "audiusHandle" TEXT,
    "audiusName" TEXT,
    "audiusAvatar" TEXT,
    "audiusVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'INVESTOR',
    "preferredMode" TEXT NOT NULL DEFAULT 'INVESTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongToken" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "mintAddress" TEXT,
    "audiusTrackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistWalletId" TEXT NOT NULL,
    "artworkUrl" TEXT,
    "streamUrl" TEXT,
    "supply" DOUBLE PRECISION NOT NULL DEFAULT 1000000,
    "circulating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserveSol" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "curveSlope" DOUBLE PRECISION NOT NULL DEFAULT 0.0000005,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.001,
    "artistShareBps" INTEGER NOT NULL DEFAULT 5000,
    "holderShareBps" INTEGER NOT NULL DEFAULT 3000,
    "protocolShareBps" INTEGER NOT NULL DEFAULT 2000,
    "streamingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tradingFeesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "externalRevenueEnabled" BOOLEAN NOT NULL DEFAULT false,
    "streams" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "performance" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0.001,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "royaltyPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ath" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "athAt" TIMESTAMP(3),
    "distributor" TEXT,
    "royaltyVault" TEXT,
    "splitsLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "liquidityTokenAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquidityPairAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquidityPairAsset" TEXT NOT NULL DEFAULT 'SOL',
    "liquidityLockDays" INTEGER NOT NULL DEFAULT 0,
    "liquidityLocked" BOOLEAN NOT NULL DEFAULT false,
    "liquidityHealth" INTEGER NOT NULL DEFAULT 0,
    "maxWalletBps" INTEGER NOT NULL DEFAULT 500,
    "artistAllocationBps" INTEGER NOT NULL DEFAULT 2000,
    "royaltyStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "riskLevel" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "songId" TEXT,
    "mint" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "costBasis" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "txSig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricePoint" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PricePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltyPayout" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "userId" TEXT,
    "bucket" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoyaltyPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketEvent" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songId" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "costBasis" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "totalUsd" DOUBLE PRECISION NOT NULL,
    "txSig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_audiusUserId_key" ON "User"("audiusUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SongToken_symbol_key" ON "SongToken"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "SongToken_mintAddress_key" ON "SongToken"("mintAddress");

-- CreateIndex
CREATE UNIQUE INDEX "SongToken_audiusTrackId_key" ON "SongToken"("audiusTrackId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_mint_idx" ON "Report"("mint");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_userId_songId_key" ON "Holding"("userId", "songId");

-- CreateIndex
CREATE INDEX "Trade_songId_createdAt_idx" ON "Trade"("songId", "createdAt");

-- CreateIndex
CREATE INDEX "PricePoint_songId_ts_idx" ON "PricePoint"("songId", "ts");

-- CreateIndex
CREATE INDEX "RoyaltyPayout_songId_createdAt_idx" ON "RoyaltyPayout"("songId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketEvent_createdAt_idx" ON "MarketEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Watch_userId_songId_key" ON "Watch"("userId", "songId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoinHolding_userId_mint_key" ON "CoinHolding"("userId", "mint");

-- CreateIndex
CREATE INDEX "CoinTrade_mint_createdAt_idx" ON "CoinTrade"("mint", "createdAt");

-- AddForeignKey
ALTER TABLE "SongToken" ADD CONSTRAINT "SongToken_artistWalletId_fkey" FOREIGN KEY ("artistWalletId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricePoint" ADD CONSTRAINT "PricePoint_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyPayout" ADD CONSTRAINT "RoyaltyPayout_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyPayout" ADD CONSTRAINT "RoyaltyPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketEvent" ADD CONSTRAINT "MarketEvent_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinHolding" ADD CONSTRAINT "CoinHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTrade" ADD CONSTRAINT "CoinTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
