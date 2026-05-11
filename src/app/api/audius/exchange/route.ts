import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";

const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
const API_KEY = process.env.NEXT_PUBLIC_AUDIUS_API_KEY || "";
// Primary endpoint for OAuth token exchange and authenticated profile fetch.
const API_BASE = "https://api.audius.co";
const TOKEN_TIMEOUT_MS = 6_500;
const PROFILE_TIMEOUT_MS = 4_500;

async function discoveryHosts(): Promise<string[]> {
  const pinned = process.env.AUDIUS_DISCOVERY_HOST;
  return pinned ? [pinned] : [API_BASE];
}

function shapeProfile(data: any) {
  return {
    userId: String(data.userId ?? data.id ?? data.user_id ?? ""),
    handle: data.handle ?? "",
    name: data.name ?? "",
    verified: !!(data.verified ?? data.is_verified),
    avatar:
      data.profilePicture?.["480x480"] ||
      data.profilePicture?.["150x150"] ||
      data.profilePicture?.["1000x1000"] ||
      data.profile_picture?.["480x480"] ||
      data.profile_picture?.["150x150"] ||
      null,
    sub: data.sub,
    wallets: {
      sol: data.spl_wallet ?? data.splWallet ?? data.spl_wallet_address ?? data.solana_wallet ?? null,
      eth: data.erc_wallet ?? data.ercWallet ?? data.wallet ?? null,
    },
  };
}

async function tryExchange(host: string, code: string, codeVerifier: string, redirectUri: string) {
  const url = `${host}/v1/oauth/token`;
  // Try documented JSON shape first (client_id = api_key), then legacy form-encoded.
  const clientId = API_KEY || APP;
  const attempts: { headers: Record<string, string>; body: string }[] = [
    {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code, code_verifier: codeVerifier, redirect_uri: redirectUri,
        client_id: clientId, api_key: API_KEY || undefined, app_name: APP,
      }),
    },
    {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code, code_verifier: codeVerifier, redirect_uri: redirectUri,
        client_id: clientId, ...(API_KEY ? { api_key: API_KEY } : {}), app_name: APP,
      }).toString(),
    },
  ];
  let lastErr: { status: number; text: string } | null = null;
  for (const a of attempts) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), TOKEN_TIMEOUT_MS);
      const r = await fetch(url, { method: "POST", headers: a.headers, body: a.body, cache: "no-store", signal: ctrl.signal });
      clearTimeout(id);
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j?.access_token) return { ok: true as const, tokens: j };
      }
      const t = await r.text().catch(() => "");
      lastErr = { status: r.status, text: t.slice(0, 400) };
      // 4xx means the request reached Audius but was rejected — try next
      // payload shape. 5xx / network → try next host.
      if (r.status >= 500) return { ok: false as const, ...lastErr };
    } catch (e: any) {
      const text = e?.name === "AbortError"
        ? `Audius token server timed out after ${Math.round(TOKEN_TIMEOUT_MS / 1000)} seconds at ${host}`
        : e?.message ?? String(e);
      lastErr = { status: 0, text };
      return { ok: false as const, ...lastErr };
    }
  }
  return { ok: false as const, status: lastErr?.status ?? 0, text: lastErr?.text ?? "" };
}

/** POST { code, codeVerifier, redirectUri } → { ok, profile } */
export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "Audius OAuth is not configured. Set NEXT_PUBLIC_AUDIUS_API_KEY and restart the app." },
      { status: 503 },
    );
  }

  const { code, codeVerifier, redirectUri } = await req.json().catch(() => ({}));
  if (!code || !codeVerifier || !redirectUri) {
    return NextResponse.json({ error: "code, codeVerifier, redirectUri required" }, { status: 400 });
  }

  const hosts = await discoveryHosts();
  // Prepend the canonical API gateway — it is the documented primary endpoint
  // for OAuth token exchange and authenticated calls (GET /v1/me).
  const allHosts = Array.from(new Set([API_BASE, ...hosts].filter(Boolean)));

  // 1) Exchange auth code → access_token. Try api.audius.co first, then
  //    the canonical Open Audio/Audius API gateway first.
  let tokens: any = null;
  let lastErr = "all hosts failed";
  for (const host of allHosts.slice(0, 3)) {
    const r = await tryExchange(host, String(code), String(codeVerifier), String(redirectUri));
    if (r.ok) { tokens = r.tokens; break; }
    lastErr = `(${r.status}) ${r.text}`;
    if (r.status >= 400 && r.status < 500 && /invalid_grant|expired|already used/i.test(r.text)) break; // hard reject
  }
  if (!tokens?.access_token) {
    console.error("Audius token exchange failed", { redirectUri, lastErr });
    return NextResponse.json({ error: `Token exchange failed: ${lastErr}` }, { status: 401 });
  }
  const accessToken: string = tokens.access_token;

  // 2) Fetch profile. Per docs: GET /v1/me with Bearer token on api.audius.co.
  //    Fall back to /v1/users/account on the configured gateway if that fails.
  let data: any = null;

  // Primary: documented /v1/me endpoint
  try {
    const meUrl = new URL(`${API_BASE}/v1/me`);
    meUrl.searchParams.set("app_name", APP);
    meUrl.searchParams.set("api_key", API_KEY);
    const j = await fetchJson<any>(meUrl.toString(), {
      cache: "no-store",
      headers: { authorization: `Bearer ${accessToken}` },
    }, PROFILE_TIMEOUT_MS).catch((e) => {
      console.error("Audius /v1/me failed", e);
      return null;
    });
    if (j) {
      data = j?.data ?? j;
      if (!data?.userId && !data?.id && !data?.handle) data = null;
    }
  } catch {}

  // Fallback: /v1/users/account on discovery nodes
  if (!data) {
    for (const host of hosts.slice(0, 1)) {
      try {
        const accountUrl = new URL(`${host}/v1/users/account`);
        accountUrl.searchParams.set("app_name", APP);
        accountUrl.searchParams.set("api_key", API_KEY);
        const j = await fetchJson<any>(accountUrl.toString(), {
          cache: "no-store",
          headers: { authorization: `Bearer ${accessToken}` },
        }, PROFILE_TIMEOUT_MS).catch(() => null);
        if (j) {
          data = j?.data ?? j;
          if (data?.userId || data?.id || data?.handle) break;
          data = null;
        }
      } catch {}
    }
  }

  // Fallback: /v1/users/verify_token
  if (!data) {
    for (const host of allHosts.slice(0, 2)) {
      try {
        const j = await fetchJson<any>(
          `${host}/v1/users/verify_token?token=${encodeURIComponent(accessToken)}&app_name=${APP}&api_key=${encodeURIComponent(API_KEY)}`,
          { cache: "no-store" },
          PROFILE_TIMEOUT_MS,
        ).catch(() => null);
        if (j?.data) { data = j.data; break; }
      } catch {}
    }
  }

  // Last resort: decode JWT and fetch by user id
  if (!data) {
    try {
      const b = accessToken.split(".")[1];
      if (b) {
        const padded = b.replace(/-/g, "+").replace(/_/g, "/").padEnd(b.length + ((4 - (b.length % 4)) % 4), "=");
        const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
        const id = decoded?.userId ?? decoded?.sub;
        if (id) {
          for (const host of allHosts.slice(0, 2)) {
            const userUrl = new URL(`${host}/v1/users/${encodeURIComponent(String(id))}`);
            userUrl.searchParams.set("app_name", APP);
            userUrl.searchParams.set("api_key", API_KEY);
            const j = await fetchJson<any>(userUrl.toString(), { cache: "no-store" }, PROFILE_TIMEOUT_MS).catch(() => null);
            if (j?.data) { data = j.data; break; }
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (!data) return NextResponse.json({ error: "Could not fetch Audius profile" }, { status: 500 });

  const profile = shapeProfile(data);
  return NextResponse.json({ ok: true, profile });
}
