-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "walletType" TEXT NOT NULL DEFAULT 'solana',
    "handle" TEXT,
    "audiusUserId" TEXT,
    "audiusHandle" TEXT,
    "audiusName" TEXT,
    "audiusAvatar" TEXT,
    "audiusVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SongToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "mintAddress" TEXT,
    "audiusTrackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistWalletId" TEXT NOT NULL,
    "artworkUrl" TEXT,
    "streamUrl" TEXT,
    "supply" REAL NOT NULL DEFAULT 1000000,
    "circulating" REAL NOT NULL DEFAULT 0,
    "reserveSol" REAL NOT NULL DEFAULT 0,
    "curveSlope" REAL NOT NULL DEFAULT 0.0000005,
    "basePrice" REAL NOT NULL DEFAULT 0.001,
    "royaltyShareBps" INTEGER NOT NULL DEFAULT 3000,
    "streams" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "performance" REAL NOT NULL DEFAULT 1.0,
    "price" REAL NOT NULL DEFAULT 0.001,
    "volume24h" REAL NOT NULL DEFAULT 0,
    "marketCap" REAL NOT NULL DEFAULT 0,
    "royaltyPool" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SongToken_artistWalletId_fkey" FOREIGN KEY ("artistWalletId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "costBasis" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Holding_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "price" REAL NOT NULL,
    "total" REAL NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0,
    "txSig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricePoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "songId" TEXT NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "PricePoint_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoyaltyPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "songId" TEXT NOT NULL,
    "userId" TEXT,
    "bucket" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoyaltyPayout_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoyaltyPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "songId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketEvent_songId_fkey" FOREIGN KEY ("songId") REFERENCES "SongToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "Holding_userId_songId_key" ON "Holding"("userId", "songId");

-- CreateIndex
CREATE INDEX "Trade_songId_createdAt_idx" ON "Trade"("songId", "createdAt");

-- CreateIndex
CREATE INDEX "PricePoint_songId_ts_idx" ON "PricePoint"("songId", "ts");

-- CreateIndex
CREATE INDEX "RoyaltyPayout_songId_createdAt_idx" ON "RoyaltyPayout"("songId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketEvent_createdAt_idx" ON "MarketEvent"("createdAt");
