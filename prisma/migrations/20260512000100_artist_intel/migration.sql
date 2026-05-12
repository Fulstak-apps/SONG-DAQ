CREATE TABLE "ArtistExternalProfile" (
  "id" TEXT NOT NULL,
  "artistKey" TEXT NOT NULL,
  "artistName" TEXT,
  "platform" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "handle" TEXT,
  "displayName" TEXT,
  "imageUrl" TEXT,
  "bio" TEXT,
  "followerCount" DOUBLE PRECISION,
  "popularityScore" DOUBLE PRECISION,
  "metricsJson" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sourceType" TEXT NOT NULL DEFAULT 'auto_detected',
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArtistExternalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SongExternalLink" (
  "id" TEXT NOT NULL,
  "songKey" TEXT,
  "artistKey" TEXT,
  "songTitle" TEXT,
  "artistName" TEXT,
  "platform" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT,
  "imageUrl" TEXT,
  "channelName" TEXT,
  "viewCount" DOUBLE PRECISION,
  "likeCount" DOUBLE PRECISION,
  "commentCount" DOUBLE PRECISION,
  "publishedAt" TIMESTAMP(3),
  "metricsJson" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sourceType" TEXT NOT NULL DEFAULT 'auto_detected',
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SongExternalLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformMetric" (
  "id" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "metricName" TEXT NOT NULL,
  "metricValue" DOUBLE PRECISION,
  "metricText" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'auto_detected',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArtistExternalProfile_artistKey_platform_idx" ON "ArtistExternalProfile"("artistKey", "platform");
CREATE INDEX "ArtistExternalProfile_platform_status_idx" ON "ArtistExternalProfile"("platform", "status");
CREATE UNIQUE INDEX "ArtistExternalProfile_artistKey_platform_url_key" ON "ArtistExternalProfile"("artistKey", "platform", "url");

CREATE INDEX "SongExternalLink_songKey_platform_idx" ON "SongExternalLink"("songKey", "platform");
CREATE INDEX "SongExternalLink_artistKey_platform_idx" ON "SongExternalLink"("artistKey", "platform");
CREATE INDEX "SongExternalLink_platform_status_idx" ON "SongExternalLink"("platform", "status");
CREATE UNIQUE INDEX "SongExternalLink_platform_url_key" ON "SongExternalLink"("platform", "url");

CREATE INDEX "PlatformMetric_targetType_targetKey_platform_idx" ON "PlatformMetric"("targetType", "targetKey", "platform");
CREATE INDEX "PlatformMetric_platform_metricName_idx" ON "PlatformMetric"("platform", "metricName");
