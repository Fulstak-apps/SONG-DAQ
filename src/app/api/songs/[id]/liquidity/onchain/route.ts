import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireArtist, AuthError } from "@/lib/auth";
import { isValidPubkey } from "@/lib/solana";
import { buildCpmmLiquidityTransaction } from "@/lib/raydium";
import { databaseReadiness } from "@/lib/appMode";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const database = databaseReadiness();
    if (!database.productionReady) {
      return NextResponse.json(
        { error: "Liquidity transaction prep needs a reachable production database.", recommendation: database.recommendation },
        { status: 503 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const { wallet, tokenAmount = 0, pairAmount = 0, pairAsset = "SOL", lockDays = 30 } = body ?? {};

    if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
    if (!isValidPubkey(String(wallet))) return NextResponse.json({ error: "invalid wallet" }, { status: 422 });

    const artist = await requireArtist(String(wallet));
    const song = await prisma.songToken.findFirst({
      where: {
        OR: [{ id: ctx.params.id }, { symbol: ctx.params.id.toUpperCase() }, { audiusTrackId: ctx.params.id }],
      },
      include: { artistWallet: { select: { wallet: true } } },
    });

    if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (song.artistWallet.wallet !== artist.user.wallet) {
      return NextResponse.json({ error: "Only the launching artist can add liquidity to this token" }, { status: 403 });
    }
    if (!song.mintAddress) {
      return NextResponse.json({ error: "This token does not have an SPL mint yet" }, { status: 422 });
    }

    const normalizedTokenAmount = Number(tokenAmount);
    const normalizedPairAmount = Number(pairAmount);
    const normalizedLockDays = Number(lockDays);
    const normalizedPairAsset = String(pairAsset || "SOL").toUpperCase() as "SOL" | "USDC" | "AUDIO";
    if (!["SOL", "USDC", "AUDIO"].includes(normalizedPairAsset)) {
      return NextResponse.json({ error: "Song Coin liquidity must be paired with SOL, USDC, or AUDIO." }, { status: 422 });
    }

    if (!(normalizedTokenAmount > 0) || !(normalizedPairAmount > 0) || !Number.isFinite(normalizedLockDays) || normalizedLockDays < 30) {
      return NextResponse.json(
        { error: "Liquidity is required before launch. This protects buyers and allows trading to start fairly." },
        { status: 422 },
      );
    }

    const tx = await buildCpmmLiquidityTransaction({
      owner: artist.user.wallet,
      mintAddress: song.mintAddress,
      tokenAmount: normalizedTokenAmount,
      pairAmount: normalizedPairAmount,
      pairAsset: normalizedPairAsset,
    });

    return NextResponse.json({
      transaction: tx.base64Transaction,
      poolId: tx.poolId,
      lpMint: tx.lpMint,
      mintA: tx.mintA,
      mintB: tx.mintB,
      configId: tx.configId,
      liquidity: {
        tokenAmount: normalizedTokenAmount,
        pairAmount: normalizedPairAmount,
        pairAsset: normalizedPairAsset,
        lockDays: normalizedLockDays,
      },
      message: `Ready for wallet approval. This creates the public ${song.symbol} liquidity pool with ${normalizedTokenAmount.toLocaleString()} tokens and ${normalizedPairAmount} ${normalizedPairAsset}. It does not request a private key, message signature, or unlimited approval.`,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to prepare liquidity transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
