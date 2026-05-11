import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/adminSession";
import { canMarkLive, riskLevelForLiquidity } from "@/lib/launchState";

export const dynamic = "force-dynamic";

type Action =
  | "REPORT_REVIEWED"
  | "REPORT_ACTIONED"
  | "REPORT_OPEN"
  | "SONG_LIVE"
  | "SONG_RESTRICT"
  | "SONG_DELIST"
  | "SONG_LOCK_SPLITS"
  | "SONG_UNLOCK_SPLITS"
  | "SONG_VERIFY_ROYALTY"
  | "SONG_ROYALTY_NEEDS_UPDATE"
  | "SONG_PAYMENT_RECEIVED"
  | "SONG_POOL_CONTRIBUTED"
  | "SONG_ROYALTY_MISSED"
  | "SONG_MARK_PENDING"
  | "USER_PROMOTE_ADMIN"
  | "USER_PROMOTE_ARTIST"
  | "USER_SET_INVESTOR";

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const wallet = asString(body.wallet);
  const entity = asString(body.entity);
  const id = asString(body.id);
  const action = asString(body.action) as Action;
  const note = asString(body.note).slice(0, 500);

  if (!verifyAdminSession(req)) {
    if (!wallet) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
    try {
      await requireAdmin(wallet);
    } catch (e: any) {
      const status = e.status || 403;
      return NextResponse.json({ error: status === 403 ? "Admin role required" : e.message || "Admin access unavailable" }, { status });
    }
  }
  if (!entity || !id || !action) return NextResponse.json({ error: "entity, id, action required" }, { status: 400 });

  let result: any = null;
  let auditSongId: string | null = null;

  if (entity === "report") {
    if (!["REPORT_REVIEWED", "REPORT_ACTIONED", "REPORT_OPEN"].includes(action)) {
      return NextResponse.json({ error: "Invalid report action" }, { status: 422 });
    }
    const status = action === "REPORT_REVIEWED" ? "REVIEWED" : action === "REPORT_ACTIONED" ? "ACTIONED" : "OPEN";
    result = await prisma.report.update({
      where: { id },
      data: { status },
      include: { song: true, reporter: true },
    });
    auditSongId = result.songId ?? null;
  }

  if (entity === "song") {
    const song = await prisma.songToken.findUnique({ where: { id } });
    if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });
    auditSongId = song.id;
    const data: Record<string, any> = {};
    if (action === "SONG_LIVE") {
      const liquidityEvent = await prisma.marketEvent.findFirst({
        where: { songId: song.id, kind: "LIQUIDITY" },
        orderBy: { createdAt: "desc" },
      });
      const payload = safeJson(liquidityEvent?.payload);
      const liquidity = (payload as any)?.liquidity ?? {};
      const txSig = String(liquidity.liquidityTxSig || "");
      const pool = String(liquidity.poolId || "");
      const liveCheck = canMarkLive({
        tokenAmount: Number(song.liquidityTokenAmount || 0),
        pairAmount: Number(song.liquidityPairAmount || 0),
        pairAsset: song.liquidityPairAsset,
        lockDays: Number(song.liquidityLockDays || 0),
        liquidityTxSig: txSig || null,
        poolId: pool || null,
        confirmed: Boolean(txSig && pool),
      });
      if (!liveCheck.ok) {
        return NextResponse.json({
          error: "Cannot mark live without confirmed launch liquidity.",
          details: liveCheck.errors,
        }, { status: 422 });
      }
      data.status = "LIVE";
      data.liquidityLocked = true;
      data.liquidityHealth = liveCheck.health;
      data.riskLevel = riskLevelForLiquidity(liveCheck.health);
    }
    else if (action === "SONG_RESTRICT") data.status = "RESTRICTED";
    else if (action === "SONG_DELIST") data.status = "DELISTED";
    else if (action === "SONG_LOCK_SPLITS") {
      data.splitsLocked = true;
      data.royaltyStatus = "LOCKED";
      data.royaltyVerificationStatus = "verified";
      data.royaltyBacked = true;
      data.royaltyVerifiedAt = new Date();
      data.royaltyVerifiedBy = wallet || "admin-session";
    } else if (action === "SONG_UNLOCK_SPLITS") {
      data.splitsLocked = false;
      data.royaltyBacked = false;
      data.royaltyVerificationStatus = "needs_update";
      if (song.royaltyStatus === "LOCKED") data.royaltyStatus = "PENDING";
    } else if (action === "SONG_VERIFY_ROYALTY") {
      data.royaltyStatus = "VERIFIED";
      data.splitsLocked = true;
      data.royaltyVerificationStatus = "verified";
      data.royaltyBacked = true;
      data.royaltyVerifiedAt = new Date();
      data.royaltyVerifiedBy = wallet || "admin-session";
    } else if (action === "SONG_ROYALTY_NEEDS_UPDATE") {
      data.royaltyStatus = "NEEDS_UPDATE";
      data.royaltyVerificationStatus = "needs_update";
      data.royaltyBacked = false;
    } else if (action === "SONG_PAYMENT_RECEIVED") {
      data.royaltyVerificationStatus = "payment_received";
      data.lastRoyaltyPaymentDate = new Date();
    } else if (action === "SONG_POOL_CONTRIBUTED") {
      data.royaltyVerificationStatus = "pool_contributed";
      data.lastRoyaltyPoolContributionDate = new Date();
    } else if (action === "SONG_ROYALTY_MISSED") {
      data.royaltyVerificationStatus = "missed_payment";
    } else if (action === "SONG_MARK_PENDING") {
      data.status = "PENDING_LIQUIDITY";
    } else {
      return NextResponse.json({ error: "Invalid song action" }, { status: 422 });
    }
    result = await prisma.songToken.update({
      where: { id },
      data,
      include: {
        artistWallet: { select: { wallet: true, handle: true, audiusHandle: true, audiusVerified: true } },
        _count: { select: { reports: true, trades: true, payouts: true, watchers: true, events: true } },
      },
    });
  }

  if (entity === "user") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (action === "USER_PROMOTE_ADMIN") {
      result = await prisma.user.update({ where: { id }, data: { role: "ADMIN", preferredMode: "ARTIST" } });
    } else if (action === "USER_PROMOTE_ARTIST") {
      result = await prisma.user.update({ where: { id }, data: { role: "ARTIST", preferredMode: "ARTIST" } });
    } else if (action === "USER_SET_INVESTOR") {
      result = await prisma.user.update({ where: { id }, data: { role: "INVESTOR", preferredMode: "INVESTOR" } });
    } else {
      return NextResponse.json({ error: "Invalid user action" }, { status: 422 });
    }
  }

  if (auditSongId) {
    await prisma.marketEvent.create({
      data: {
        songId: auditSongId,
        kind: "ADMIN_ACTION",
        payload: JSON.stringify({ entity, id, action, note, wallet, ts: Date.now() }),
      },
    }).catch(() => {});
  }

  await prisma.adminLog.create({
    data: {
      adminId: wallet || "admin-session",
      action,
      targetType: entity,
      targetId: id,
      notes: note || undefined,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, result });
}

function safeJson(value?: string | null) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
