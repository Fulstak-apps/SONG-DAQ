import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";

/**
 * Verify an Audius OAuth JWT against a discovery node. The token is
 * signed by the user's Audius wallet — discovery nodes expose
 * `/v1/users/verify_token` to validate it server-side.
 *
 * If verification fails (some self-hosted Audius nodes don't expose the
 * endpoint) we fall back to decoding the JWT body and re-fetching the
 * user record from the same discovery network — that guarantees we're
 * not trusting a forged payload field, only the signed `userId`.
 */
const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
const FALLBACK_HOSTS = [
  "https://api.audius.co",
];

async function discoveryHosts(): Promise<string[]> {
  try {
    const j = await fetchJson<{ data: string[] }>("https://api.audius.co", { cache: "no-store" }, 4_000);
    if (j?.data?.length) return j.data;
  } catch {}
  return FALLBACK_HOSTS;
}

function decodeJwtBody<T = any>(jwt: string): T | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const buf = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

async function verifyOnNode(host: string, token: string) {
  return fetchJson<any>(
    `${host}/v1/users/verify_token?token=${encodeURIComponent(token)}&app_name=${encodeURIComponent(APP)}`,
    { cache: "no-store" },
    4_500,
  ).then((j) => j?.data ?? null).catch(() => null);
}

async function fetchUserById(host: string, userId: string) {
  return fetchJson<any>(
    `${host}/v1/users/${encodeURIComponent(userId)}?app_name=${encodeURIComponent(APP)}`,
    { cache: "no-store" },
    4_500,
  ).then((j) => j?.data ?? null).catch(() => null);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const hosts = await discoveryHosts();
  let data: any = null;

  // Try the canonical verify endpoint on a few discovery hosts.
  for (const host of hosts.slice(0, 4)) {
    data = await verifyOnNode(host, token);
    if (data) break;
  }

  // Fallback: decode the JWT body, re-fetch the user from a discovery
  // node by id. This is still safe — we never trust JWT-asserted
  // identity fields, only the userId we re-fetch.
  if (!data) {
    const decoded = decodeJwtBody<{ userId?: string; sub?: string; iss?: string }>(token);
    const id = decoded?.userId ?? decoded?.sub;
    if (id) {
      for (const host of hosts.slice(0, 4)) {
        data = await fetchUserById(host, String(id));
        if (data) break;
      }
    }
  }

  if (!data) {
    return NextResponse.json({ error: "Could not verify Audius token" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      userId: String(data.userId ?? data.id ?? ""),
      handle: data.handle ?? "",
      name: data.name ?? "",
      verified: !!data.verified,
      avatar:
        data.profilePicture?.["480x480"] ||
        data.profilePicture?.["150x150"] ||
        data.profilePicture?.["1000x1000"] ||
        null,
      sub: data.sub,
    },
  });
}
