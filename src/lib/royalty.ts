/**
 * Off-chain royalty distribution mirror. Mirrors the on-chain
 * accumulator math: revenue is split per the artist's RoyaltyConfig
 * and the holder bucket is paid pro-rata to current holders.
 */

import { prisma } from "./db";
import { splitRevenue, type RoyaltyConfig } from "./royaltyConfig";

export interface DistributionResult {
  toArtist: number;
  toHolders: number;
  toTreasury: number;
  perToken: number;
  payouts: { userId: string; amount: number }[];
}

export async function distributeRoyalty(
  songId: string,
  amountSol: number,
  source: string = "audius",
): Promise<DistributionResult> {
  if (amountSol <= 0) throw new Error("amount must be > 0");
  const song = await prisma.songToken.findUnique({
    where: { id: songId },
    include: { holdings: true },
  });
  if (!song) throw new Error("song not found");

  const cfg: RoyaltyConfig = {
    artistShareBps: song.artistShareBps,
    holderShareBps: song.holderShareBps,
    protocolShareBps: song.protocolShareBps,
    streamingEnabled: song.streamingEnabled,
    tradingFeesEnabled: song.tradingFeesEnabled,
    externalRevenueEnabled: song.externalRevenueEnabled,
  };

  // Reject sources the artist hasn't enabled.
  if (source === "audius" && !cfg.streamingEnabled) throw new Error("streaming royalties disabled");
  if (source === "trading" && !cfg.tradingFeesEnabled) throw new Error("trading-fee royalties disabled");
  if (source === "external" && !cfg.externalRevenueEnabled) throw new Error("external royalties disabled");

  const { toArtist, toHolders, toTreasury } = splitRevenue(amountSol, cfg);
  const totalCirculating = song.circulating;
  const payouts: { userId: string; amount: number }[] = [];

  if (totalCirculating > 0 && toHolders > 0) {
    for (const h of song.holdings) {
      const share = h.amount / totalCirculating;
      const amt = toHolders * share;
      if (amt > 0) payouts.push({ userId: h.userId, amount: amt });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.royaltyPayout.create({
      data: { songId, bucket: "ARTIST", amount: toArtist },
    });
    await tx.royaltyPayout.create({
      data: { songId, bucket: "TREASURY", amount: toTreasury },
    });
    for (const p of payouts) {
      await tx.royaltyPayout.create({
        data: { songId, userId: p.userId, bucket: "HOLDER", amount: p.amount },
      });
    }
    await tx.songToken.update({
      where: { id: songId },
      data: {
        royaltyPool: { increment: amountSol },
        reserveSol: { increment: toTreasury },
      },
    });
    await tx.marketEvent.create({
      data: {
        songId,
        kind: "ROYALTY",
        payload: JSON.stringify({
          source, amountSol, toArtist, toHolders, toTreasury,
          holders: payouts.length, symbol: song.symbol,
        }),
      },
    });
  });

  return {
    toArtist,
    toHolders,
    toTreasury,
    perToken: totalCirculating > 0 ? toHolders / totalCirculating : 0,
    payouts,
  };
}
