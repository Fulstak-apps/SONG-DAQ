/**
 * Role resolution + permission enforcement.
 *
 * Identity is built from two factors:
 *   - wallet (Solana / EVM) — the signing identity that owns tokens
 *   - Audius account (via OAuth) — the content identity
 *
 * Role rule: if the linked Audius account is verified OR has at least
 * one published track, the user may act as ARTIST. Otherwise INVESTOR
 * only.
 */

import { prisma } from "./db";

export type Role = "ARTIST" | "INVESTOR";

export interface AuthContext {
  user: { id: string; wallet: string; walletType: string; role: Role; preferredMode: Role; audiusUserId: string | null; audiusHandle: string | null };
}

export class AuthError extends Error {
  status: number;
  constructor(msg: string, status = 401) { super(msg); this.status = status; }
}

/**
 * Resolve identity from request payload (wallet + optional audius).
 * Creates the user record if missing.
 */
export async function resolveActor(input: {
  wallet?: string;
  walletType?: string;
  audiusUserId?: string;
}) {
  if (!input.wallet) throw new AuthError("wallet required");
  let user = await prisma.user.findUnique({ where: { wallet: input.wallet } });
  if (!user) {
    user = await prisma.user.create({
      data: { wallet: input.wallet, walletType: input.walletType || "solana" },
    });
  }
  return user;
}

export async function requireArtist(wallet: string): Promise<AuthContext> {
  const user = await prisma.user.findUnique({ where: { wallet } });
  if (!user) throw new AuthError("user not found", 401);
  if (user.role !== "ARTIST") throw new AuthError("Artist role required. Sign in with a verified Audius account.", 403);
  return { user: user as AuthContext["user"] };
}

/**
 * Promote a user to ARTIST when their linked Audius account is verified
 * or owns the track they're trying to launch.
 */
export async function maybePromoteToArtist(userId: string): Promise<Role> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return "INVESTOR";
  if (u.role === "ARTIST") return "ARTIST";
  if (!u.audiusUserId) return "INVESTOR";
  // verified Audius account → upgrade
  if (u.audiusVerified) {
    await prisma.user.update({ where: { id: u.id }, data: { role: "ARTIST" } });
    return "ARTIST";
  }
  return "INVESTOR";
}

/**
 * Verify the Audius account currently linked to `wallet` actually owns
 * the given Audius track (track.user.id matches user.audiusUserId).
 * Promotes to ARTIST on success.
 */
export async function assertAudiusTrackOwnership(wallet: string, audiusTrackId: string): Promise<AuthContext> {
  const user = await prisma.user.findUnique({ where: { wallet } });
  if (!user) throw new AuthError("user not found", 401);
  if (!user.audiusUserId) throw new AuthError("Sign in with Audius to verify track ownership", 403);

  const { getTrack } = await import("./audius");
  const track = await getTrack(audiusTrackId);
  const owner = String((track as any).user?.id ?? "");
  if (!owner) throw new AuthError("Audius track has no resolvable owner", 422);
  if (owner !== user.audiusUserId) {
    throw new AuthError("This Audius track does not belong to your signed-in account", 403);
  }
  if (user.role !== "ARTIST") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ARTIST" } });
  }
  const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
  return { user: refreshed as AuthContext["user"] };
}
