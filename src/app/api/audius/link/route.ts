import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/userResolver";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { wallet, walletType = "solana", profile, role } = await req.json();
  if (!wallet || !profile?.userId) {
    return NextResponse.json({ error: "wallet and profile required" }, { status: 400 });
  }
  const user = await getOrCreateUser(wallet, walletType);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      audiusUserId: String(profile.userId),
      audiusHandle: profile.handle ?? null,
      audiusName: profile.name ?? null,
      audiusAvatar: profile.avatar ?? null,
      audiusVerified: !!profile.verified,
      ...(role ? { role, preferredMode: role } : {}),
    },
  });
  return NextResponse.json({ ok: true, user: updated });
}
