import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { maybePromoteToArtist, syncConfiguredAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, ms = 1_200): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("user lookup timed out")), ms)),
  ]);
}

async function findUser(wallet: string) {
  const configuredAdmin = await syncConfiguredAdmin(wallet);
  const u = configuredAdmin || await prisma.user.findUnique({ where: { wallet } });
  if (!u) return null;
  if (configuredAdmin) return configuredAdmin;
  await maybePromoteToArtist(u.id);
  return prisma.user.findUnique({ where: { wallet } });
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ user: null });
  try {
    const u = await withTimeout(findUser(wallet));
    if (!u) return NextResponse.json({ user: null });
    return NextResponse.json({ user: u });
  } catch {
    return NextResponse.json({ user: null, databaseAvailable: false });
  }
}
