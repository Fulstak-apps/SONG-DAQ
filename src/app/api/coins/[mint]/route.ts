import { NextRequest, NextResponse } from "next/server";
import { getCoin, hydrateArtists } from "@/lib/audiusCoins";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { mint: string } }) {
  try {
    const c = await getCoin(ctx.params.mint);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    const [enriched] = await hydrateArtists([c]);
    const local = await prisma.songToken.findFirst({
      where: {
        OR: [
          { mintAddress: ctx.params.mint },
          { fakeTokenAddress: ctx.params.mint },
          { symbol: String((enriched as any).ticker || "").replace(/^\$/, "") },
        ],
      },
      select: {
        id: true,
        royaltyVerificationStatus: true,
        royaltyBacked: true,
        royaltyPercentageCommitted: true,
        totalRoyaltiesReceivedUsd: true,
        totalRoyaltyPoolContributionsUsd: true,
        totalBuybacksUsd: true,
        totalLiquidityAddedUsd: true,
        totalHolderRewardsUsd: true,
        lastRoyaltyPaymentDate: true,
        lastRoyaltyPoolContributionDate: true,
        lastRoyaltyRedistributionDate: true,
        nextExpectedRoyaltyPaymentDate: true,
        mode: true,
        isSimulated: true,
      },
    }).catch(() => null);
    return NextResponse.json({ coin: { ...enriched, ...(local ?? {}) } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
