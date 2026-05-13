import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/userResolver";
import { isAdminAudiusProfile } from "@/lib/adminIdentity";
import { databaseReadiness } from "@/lib/appMode";

export const dynamic = "force-dynamic";

function shouldSkipDatabaseLink() {
  return !databaseReadiness().productionReady;
}

function pendingLinkResponse(wallet: string, walletType: string, profile: any, nextRole?: string) {
  return NextResponse.json({
    ok: true,
    databaseAvailable: false,
    linkPending: true,
    message: "Wallet connected. Artist profile link will sync when the database is reachable.",
    user: {
      wallet,
      walletType,
      audiusUserId: String(profile.userId),
      audiusHandle: profile.handle ?? null,
      audiusName: profile.name ?? null,
      audiusAvatar: profile.avatar ?? null,
      audiusVerified: !!profile.verified,
      role: nextRole || "ARTIST",
      preferredMode: "ARTIST",
    },
  });
}

async function withDatabaseTimeout<T>(promise: Promise<T>, ms = 1_800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("database link timed out")), ms)),
  ]);
}

async function linkAudiusProfile(wallet: string, walletType: string, profile: any, nextRole?: string) {
  const user = await getOrCreateUser(wallet, walletType === "solana" ? "solana" : "solana");
  const existingLinked = await prisma.user.findUnique({
    where: { audiusUserId: String(profile.userId) },
  });

  if (existingLinked && existingLinked.id !== user.id) {
    await prisma.user.update({
      where: { id: existingLinked.id },
      data: {
        audiusUserId: null,
        audiusHandle: null,
        audiusName: null,
        audiusAvatar: null,
        audiusVerified: false,
        role: "INVESTOR",
        preferredMode: "INVESTOR",
      },
    });
  }

  return prisma.user.update({
    where: { id: user.id },
    data: {
      audiusUserId: String(profile.userId),
      audiusHandle: profile.handle ?? null,
      audiusName: profile.name ?? null,
      audiusAvatar: profile.avatar ?? null,
      audiusVerified: !!profile.verified,
      ...(nextRole ? { role: nextRole, preferredMode: nextRole === "ADMIN" ? "ARTIST" : nextRole } : {}),
    },
  });
}

export async function POST(req: NextRequest) {
  const { wallet, walletType = "solana", profile, role } = await req.json();
  if (!wallet || !profile?.userId) {
    return NextResponse.json({ error: "wallet and profile required" }, { status: 400 });
  }
  const adminProfile = isAdminAudiusProfile(profile);
  const profileVerified = Boolean(profile.verified);
  const nextRole = adminProfile ? "ADMIN" : profileVerified ? "ARTIST" : role;

  if (shouldSkipDatabaseLink()) {
    return pendingLinkResponse(wallet, walletType, profile, nextRole);
  }

  try {
    const updated = await withDatabaseTimeout(linkAudiusProfile(wallet, walletType, profile, nextRole));
    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error("Audius link failed", error);
    return pendingLinkResponse(wallet, walletType, profile, nextRole);
  }
}
