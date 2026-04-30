import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
const API_KEY = process.env.NEXT_PUBLIC_AUDIUS_API_KEY || "";
const FALLBACK_HOSTS = [
  "https://discoveryprovider.audius.co",
  "https://discoveryprovider2.audius.co",
];

async function discoveryHosts(): Promise<string[]> {
  try {
    const r = await fetch("https://api.audius.co", { next: { revalidate: 3600 } });
    const j = (await r.json()) as { data: string[] };
    if (Array.isArray(j?.data) && j.data.length) return j.data;
  } catch {}
  return FALLBACK_HOSTS;
}

function shape(u: any) {
  return {
    userId: String(u.id ?? u.user_id ?? u.userId ?? ""),
    handle: u.handle ?? "",
    name: u.name ?? "",
    verified: !!(u.is_verified ?? u.verified),
    avatar:
      u.profile_picture?.["480x480"] ||
      u.profile_picture?.["150x150"] ||
      u.profilePicture?.["480x480"] ||
      u.profilePicture?.["150x150"] ||
      null,
    wallets: {
      sol: u.spl_wallet ?? u.splWallet ?? null,
      eth: u.erc_wallet ?? u.ercWallet ?? u.wallet ?? null,
    },
    follower_count: u.follower_count ?? u.followerCount ?? 0,
    following_count: u.followee_count ?? u.followingCount ?? 0,
    track_count: u.track_count ?? u.trackCount ?? 0,
    // Audius gives us the unified AUDIO balance (sum of ERC-20 wallet,
    // wAUDIO on Solana, and any associated wallets) directly. Use that as
    // the source of truth for the chip — RPC calls miss wAUDIO + associated.
    audioBalance: Number(u.total_audio_balance ?? 0),
  };
}

/**
 * GET /api/audius/profile?handle=foo  →  { ok, profile }
 *
 * Public-data lookup. Used as the fallback "Sign in by handle" path when
 * Audius's OAuth flow is unavailable to unregistered apps. We do NOT issue
 * a session token from this — the result is read-only profile data the
 * client uses to populate the UI.
 */
export async function GET(req: NextRequest) {
  const handle = (req.nextUrl.searchParams.get("handle") ?? "").replace(/^@/, "").trim();
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });
  const hosts = await discoveryHosts();
  for (const host of hosts.slice(0, 4)) {
    try {
      const qs = new URLSearchParams({ app_name: APP });
      if (API_KEY) qs.set("api_key", API_KEY);
      const r = await fetch(
        `${host}/v1/users/handle/${encodeURIComponent(handle)}?${qs}`,
        { cache: "no-store" },
      );
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.data) return NextResponse.json({ ok: true, profile: shape(j.data) });
    } catch { /* try next host */ }
  }
  return NextResponse.json({ error: `Audius user @${handle} not found` }, { status: 404 });
}
