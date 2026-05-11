import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appMode, fakeTransactionId } from "@/lib/appMode";
import { requireAdmin } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

function statusFromAction(action?: string) {
  if (action === "needs_update") return "needs_update";
  if (action === "verified") return "verified";
  if (action === "payment_received") return "payment_received";
  if (action === "pool_contributed") return "pool_contributed";
  if (action === "redistributed") return "redistributed";
  if (action === "missed_payment") return "missed_payment";
  return "in_progress";
}

async function assertAdmin(req: NextRequest, wallet?: string) {
  if (verifyAdminSession(req)) return "admin-session";
  if (!wallet) throw Object.assign(new Error("Admin login required"), { status: 401 });
  await requireAdmin(wallet);
  return wallet;
}

export async function GET(req: NextRequest) {
  const coinId = req.nextUrl.searchParams.get("coinId") || undefined;
  const wallet = req.nextUrl.searchParams.get("wallet") || undefined;
  const admin = req.nextUrl.searchParams.get("admin") === "1";

  if (admin) {
    try {
      await assertAdmin(req, wallet);
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Admin access required" }, { status: e.status || 403 });
    }
  }

  const [requests, payments, contributions, redistributions] = await Promise.all([
    prisma.royaltyRequest.findMany({
      where: coinId ? { coinId } : undefined,
      orderBy: { createdAt: "desc" },
      take: admin ? 100 : 20,
    }),
    prisma.royaltyPayment.findMany({
      where: coinId ? { coinId } : undefined,
      orderBy: { createdAt: "desc" },
      take: admin ? 100 : 20,
    }),
    prisma.royaltyPoolContribution.findMany({
      where: coinId ? { coinId } : undefined,
      orderBy: { executedAt: "desc" },
      take: admin ? 100 : 20,
    }),
    prisma.royaltyRedistribution.findMany({
      where: coinId ? { coinId } : undefined,
      orderBy: { executedAt: "desc" },
      take: admin ? 100 : 20,
    }),
  ]);

  return NextResponse.json({ requests, payments, contributions, redistributions });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode || appMode());
  const action = String(body.action || "submit_request");

  if (action === "submit_request") {
    const coinId = body.coinId ? String(body.coinId) : undefined;
    const artistName = String(body.artistName || "").trim();
    const songTitle = String(body.songTitle || "").trim();
    if (!artistName || !songTitle) {
      return NextResponse.json({ error: "Artist name and song title are required" }, { status: 400 });
    }

    const reqRecord = await prisma.royaltyRequest.create({
      data: {
        mode,
        coinId,
        artistId: body.artistId ? String(body.artistId) : undefined,
        artistName,
        legalName: body.legalName ? String(body.legalName) : undefined,
        email: body.email ? String(body.email) : undefined,
        walletAddress: body.walletAddress ? String(body.walletAddress) : undefined,
        songTitle,
        coinToken: body.coinToken ? String(body.coinToken) : undefined,
        distributor: body.distributor ? String(body.distributor) : undefined,
        isrc: body.isrc ? String(body.isrc) : undefined,
        upc: body.upc ? String(body.upc) : undefined,
        royaltyPercentageAssigned: body.royaltyPercentageAssigned == null ? undefined : Number(body.royaltyPercentageAssigned),
        expectedMonthlyRoyaltyAmount: body.expectedMonthlyRoyaltyAmount == null ? undefined : Number(body.expectedMonthlyRoyaltyAmount),
        distributorPortalUsed: body.distributorPortalUsed ? String(body.distributorPortalUsed) : undefined,
        dateSplitInvitationSent: body.dateSplitInvitationSent ? new Date(body.dateSplitInvitationSent) : undefined,
        proofUploadUrl: body.proofUploadUrl ? String(body.proofUploadUrl) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        status: "in_progress",
      },
    });

    if (coinId) {
      await prisma.songToken.updateMany({
        where: { id: coinId },
        data: {
          royaltyVerificationStatus: "in_progress",
          royaltyBacked: false,
          royaltyRequestId: reqRecord.id,
          royaltyStatus: "PENDING",
        },
      });
    }

    await prisma.transaction.create({
      data: {
        mode,
        isSimulated: mode === "paper",
        fakeTransactionId: mode === "paper" ? fakeTransactionId("royalty_request") : undefined,
        walletAddress: body.walletAddress ? String(body.walletAddress) : undefined,
        coinId,
        action: "Royalty Request Submitted",
        status: "confirmed",
      },
    });

    return NextResponse.json({
      ok: true,
      request: reqRecord,
      message: "Your royalty setup request has been submitted. Your coin now shows Royalty Verification In Progress.",
    });
  }

  try {
    const adminId = await assertAdmin(req, body.adminWallet ? String(body.adminWallet) : undefined);
    const coinId = body.coinId ? String(body.coinId) : undefined;

    if (action === "verify_request" || action === "needs_update") {
      const requestId = String(body.requestId || "");
      if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });
      const nextStatus = statusFromAction(action === "verify_request" ? "verified" : "needs_update");
      const request = await prisma.royaltyRequest.update({
        where: { id: requestId },
        data: { status: nextStatus, adminNotes: body.adminNotes ? String(body.adminNotes) : undefined },
      });
      if (request.coinId) {
        await prisma.songToken.updateMany({
          where: { id: request.coinId },
          data: {
            royaltyVerificationStatus: nextStatus,
            royaltyBacked: nextStatus === "verified",
            royaltyPercentageCommitted: nextStatus === "verified" ? request.royaltyPercentageAssigned : undefined,
            royaltyVerifiedAt: nextStatus === "verified" ? new Date() : undefined,
            royaltyVerifiedBy: String(adminId),
            royaltyStatus: nextStatus === "verified" ? "VERIFIED" : "NEEDS_UPDATE",
            splitsLocked: nextStatus === "verified" ? true : undefined,
          },
        });
      }
      await prisma.adminLog.create({ data: { mode, adminId: String(adminId), action: `royalty_${nextStatus}`, targetType: "RoyaltyRequest", targetId: requestId, notes: body.adminNotes ? String(body.adminNotes) : undefined } });
      return NextResponse.json({ ok: true, request });
    }

    if (action === "record_payment") {
      if (!coinId) return NextResponse.json({ error: "coinId required" }, { status: 400 });
      const amount = Number(body.receivedAmountUsd);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "receivedAmountUsd must be positive" }, { status: 400 });
      const coin = await prisma.songToken.findUnique({ where: { id: coinId } });
      const payment = await prisma.royaltyPayment.create({
        data: {
          mode,
          coinId,
          artistId: coin?.artistWalletId,
          songTitle: body.songTitle ? String(body.songTitle) : coin?.title || "Unknown song",
          monthCovered: body.monthCovered ? String(body.monthCovered) : undefined,
          expectedAmountUsd: body.expectedAmountUsd == null ? undefined : Number(body.expectedAmountUsd),
          receivedAmountUsd: amount,
          currencyReceived: body.currencyReceived ? String(body.currencyReceived) : "USD",
          receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
          distributorSource: body.distributorSource ? String(body.distributorSource) : undefined,
          paymentProofUrl: body.paymentProofUrl ? String(body.paymentProofUrl) : undefined,
          referenceId: body.referenceId ? String(body.referenceId) : undefined,
          adminNotes: body.adminNotes ? String(body.adminNotes) : undefined,
          status: "payment_received",
        },
      });
      await prisma.songToken.update({
        where: { id: coinId },
        data: {
          royaltyVerificationStatus: "payment_received",
          totalRoyaltiesReceivedUsd: { increment: amount },
          lastRoyaltyPaymentDate: new Date(),
        },
      });
      await prisma.transaction.create({ data: { mode, isSimulated: mode === "paper", fakeTransactionId: mode === "paper" ? fakeTransactionId("royalty_payment") : undefined, coinId, action: "Royalty Payment Received", usdAmount: amount, status: "confirmed" } });
      await prisma.adminLog.create({ data: { mode, adminId: String(adminId), action: "royalty_payment_received", targetType: "RoyaltyPayment", targetId: payment.id } });
      return NextResponse.json({ ok: true, payment });
    }

    if (action === "pool_contribution") {
      if (!coinId) return NextResponse.json({ error: "coinId required" }, { status: 400 });
      const amount = Number(body.amountUsd);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amountUsd must be positive" }, { status: 400 });
      const contribution = await prisma.royaltyPoolContribution.create({
        data: {
          mode,
          royaltyPaymentId: body.royaltyPaymentId ? String(body.royaltyPaymentId) : undefined,
          coinId,
          amountUsd: amount,
          amountSol: body.amountSol == null ? undefined : Number(body.amountSol),
          amountUsdc: body.amountUsdc == null ? undefined : Number(body.amountUsdc),
          poolAddress: body.poolAddress ? String(body.poolAddress) : undefined,
          transactionHash: body.transactionHash ? String(body.transactionHash) : undefined,
          fakeTransactionId: mode === "paper" ? fakeTransactionId("pool") : undefined,
          notes: body.notes ? String(body.notes) : undefined,
          status: "pool_contributed",
          executedBy: String(adminId),
        },
      });
      await prisma.songToken.update({
        where: { id: coinId },
        data: {
          royaltyVerificationStatus: "pool_contributed",
          totalRoyaltyPoolContributionsUsd: { increment: amount },
          totalLiquidityAddedUsd: { increment: Number(body.liquidityAmountUsd || 0) },
          lastRoyaltyPoolContributionDate: new Date(),
        },
      });
      await prisma.transaction.create({ data: { mode, isSimulated: mode === "paper", fakeTransactionId: contribution.fakeTransactionId, transactionSignature: contribution.transactionHash, coinId, action: "Royalty Pool Contribution", usdAmount: amount, solAmount: contribution.amountSol, status: "confirmed" } });
      await prisma.adminLog.create({ data: { mode, adminId: String(adminId), action: "royalty_pool_contribution", targetType: "RoyaltyPoolContribution", targetId: contribution.id } });
      return NextResponse.json({ ok: true, contribution });
    }

    return NextResponse.json({ error: "Unknown royalty action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Royalty action failed" }, { status: e.status || 500 });
  }
}
