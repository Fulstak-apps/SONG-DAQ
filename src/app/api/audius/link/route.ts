import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/userResolver";
import { isAdminAudiusProfile } from "@/lib/adminIdentity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { wallet, walletType = "solana", profile, role } = await req.json();
  if (!wallet || !profile?.userId) {
    return NextResponse.json({ error: "wallet and profile required" }, { status: 400 });
  }
  const adminProfile = isAdminAudiusProfile(profile);
  const nextRole = adminProfile ? "ADMIN" : role;

  try {
    const user = await getOrCreateUser(wallet, walletType);
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

    const updated = await prisma.user.update({
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
    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error("Audius link failed", error);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        ok: true,
        databaseAvailable: false,
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
    return NextResponse.json({ error: "Could not save Audius artist account" }, { status: 503 });
  }
}
