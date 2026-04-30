import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
const API_KEY = process.env.NEXT_PUBLIC_AUDIUS_API_KEY || "";
const APP_BEARER = process.env.AUDIUS_API_SECRET_KEY || "";
// Primary endpoint for OAuth token exchange and authenticated profile fetch.
const API_BASE = "https://api.audius.co";
const FALLBACK_HOSTS = [
  "https://discoveryprovider.audius.co",
  "https://discoveryprovider2.audius.co",
  "https://discoveryprovider3.audius.co",
];

async function discoveryHosts(): Promise<string[]> {
  try {
    const r = await fetch("https://api.audius.co", { cache: "no-store" });
    const j = (await r.json()) as { data: string[] };
    if (Array.isArray(j?.data) && j.data.length) return j.data;
  } catch {}
  return FALLBACK_HOSTS;
}

function shapeProfile(data: any) {
  return {
    userId: String(data.userId ?? data.id ?? data.user_id ?? ""),
    handle: data.handle ?? "",
    name: data.name ?? "",
    verified: !!data.verified,
    avatar:
      data.profilePicture?.["480x480"] ||
      data.profilePicture?.["150x150"] ||
      data.profilePicture?.["1000x1000"] ||
      data.profile_picture?.["480x480"] ||
      data.profile_picture?.["150x150"] ||
      null,
    sub: data.sub,
    wallets: {
      sol: data.spl_wallet ?? data.splWallet ?? null,
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
        client_id: clientId, app_name: APP,
      }),
    },
    {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code, code_verifier: codeVerifier, redirect_uri: redirectUri,
        client_id: clientId, app_name: APP,
      }).toString(),
    },
  ];
  let lastErr: { status: number; text: string } | null = null;
  for (const a of attempts) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 12_000);
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
      lastErr = { status: 0, text: e?.message ?? String(e) };
    }
  }
  return { ok: false as const, status: lastErr?.status ?? 0, text: lastErr?.text ?? "" };
}

/** POST { code, codeVerifier, redirectUri } → { ok, profile } */
export async function POST(req: NextRequest) {
  const { code, codeVerifier, redirectUri } = await req.json().catch(() => ({}));
  if (!code || !codeVerifier || !redirectUri) {
    return NextResponse.json({ error: "code, codeVerifier, redirectUri required" }, { status: 400 });
  }

  const hosts = await discoveryHosts();
  // Prepend the canonical API gateway — it is the documented primary endpoint
  // for OAuth token exchange and authenticated calls (GET /v1/me).
  const allHosts = [API_BASE, ...hosts];

  // 1) Exchange auth code → access_token. Try api.audius.co first, then
  //    discovery nodes as fallback.
  let tokens: any = null;
  let lastErr = "all hosts failed";
  for (const host of allHosts.slice(0, 5)) {
    const r = await tryExchange(host, String(code), String(codeVerifier), String(redirectUri));
    if (r.ok) { tokens = r.tokens; break; }
    lastErr = `(${r.status}) ${r.text}`;
    if (r.status >= 400 && r.status < 500) break; // hard reject
  }
  if (!tokens?.access_token) {
    return NextResponse.json({ error: `Token exchange failed: ${lastErr}` }, { status: 401 });
  }
  const accessToken: string = tokens.access_token;

  // 2) Fetch profile. Per docs: GET /v1/me with Bearer token on api.audius.co.
  //    Fall back to /v1/users/account on discovery nodes if that fails.
  let data: any = null;

  // Primary: documented /v1/me endpoint
  try {
    const r = await fetch(`${API_BASE}/v1/me?app_name=${APP}`, {
      cache: "no-store",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (r.ok) {
      const j = await r.json();
      data = j?.data ?? j;
      if (!data?.userId && !data?.id && !data?.handle) data = null;
    }
  } catch {}

  // Fallback: /v1/users/account on discovery nodes
  if (!data) {
    for (const host of hosts.slice(0, 4)) {
      try {
        const r = await fetch(`${host}/v1/users/account?app_name=${APP}`, {
          cache: "no-store",
          headers: { authorization: `Bearer ${accessToken}` },
        });
        if (r.ok) {
          const j = await r.json();
          data = j?.data ?? j;
          if (data?.userId || data?.id || data?.handle) break;
          data = null;
        }
      } catch {}
    }
  }

  // Fallback: /v1/users/verify_token
  if (!data) {
    for (const host of allHosts.slice(0, 4)) {
      try {
        const r = await fetch(
          `${host}/v1/users/verify_token?token=${encodeURIComponent(accessToken)}&app_name=${APP}`,
          { cache: "no-store" },
        );
        if (r.ok) {
          const j = await r.json();
          if (j?.data) { data = j.data; break; }
        }
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
          for (const host of allHosts.slice(0, 4)) {
            const r = await fetch(`${host}/v1/users/${encodeURIComponent(String(id))}?app_name=${APP}`, { cache: "no-store" });
            if (r.ok) {
              const j = await r.json();
              if (j?.data) { data = j.data; break; }
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (!data) return NextResponse.json({ error: "Could not fetch Audius profile" }, { status: 500 });

  const profile = shapeProfile(data);
  return NextResponse.json({ ok: true, profile });
}
