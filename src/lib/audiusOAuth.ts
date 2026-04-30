"use client";

/**
 * Audius "Sign in with Audius" — OAuth 2.0 Authorization Code with PKCE.
 *
 * The official @audius/sdk now requires a registered hex `apiKey` (client ID)
 * to use OAuth, which means unregistered demo apps can't use it. Audius's
 * own OAuth backend, however, still accepts `app_name=…` as the app
 * identifier on `audius.co/oauth/authorize` and on the discovery node's
 * `/v1/oauth/token` exchange endpoint. So we drive the flow by hand:
 *
 *   1. Generate code_verifier + S256 code_challenge.
 *   2. Open popup synchronously (about:blank), then navigate it to
 *      audius.co/oauth/authorize once the challenge is ready.
 *   3. Audius redirects the popup to /audius/callback?code=…&state=….
 *   4. The callback page postMessages { code, state } to the opener and
 *      writes the same payload to localStorage as a fallback.
 *   5. The opener exchanges the code at a discovery node and fetches the
 *      profile via /api/audius/exchange (server side).
 */

const APP_NAME = process.env.NEXT_PUBLIC_AUDIUS_APP_NAME || "songdaq";
const API_KEY = process.env.NEXT_PUBLIC_AUDIUS_API_KEY || "";

export interface AudiusProfile {
  userId: string;
  handle: string;
  name: string;
  verified: boolean;
  avatar: string | null;
  sub?: string;
  wallets?: { sol: string | null; eth: string | null };
}

function randomString(len = 64): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] % 36).toString(36);
  return s;
}

async function pkceChallenge(verifier: string): Promise<string> {
  const raw = new TextEncoder().encode(verifier);
  const data = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", data);
  let str = "";
  const bytes = new Uint8Array(hash);
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function loginWithAudius(): Promise<AudiusProfile> {
  if (typeof window === "undefined") return Promise.reject(new Error("client only"));
  const state = randomString(24);
  const codeVerifier = randomString(64);
  const origin = window.location.origin;
  const redirect = `${origin}/audius/callback`;

  // Persist for the callback page (sessionStorage is shared with same-origin
  // popups via window.opener, but localStorage is the safer cross-tab store).
  try {
    sessionStorage.setItem("audius-pkce-verifier", codeVerifier);
    sessionStorage.setItem("audius-pkce-state", state);
    sessionStorage.setItem("audius-pkce-redirect", redirect);
    localStorage.removeItem("audius-oauth-result");
  } catch {}

  // POPUP MUST OPEN SYNCHRONOUSLY — open it now with about:blank, then
  // navigate it to the auth URL after we finish hashing.
  const w = 500, h = 720;
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
  const popup = window.open(
    "about:blank",
    "audius-oauth",
    `width=${w},height=${h},left=${left},top=${top},popup=1`,
  );
  if (!popup) {
    return Promise.reject(new Error("Popup blocked — allow popups for this site and retry"));
  }
  popup.focus?.();

  return new Promise<AudiusProfile>(async (resolve, reject) => {
    let settled = false;
    let closeTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (closeTimer) clearInterval(closeTimer);
      if (pollTimer) clearInterval(pollTimer);
    };

    const finishWithCode = async (code: string, st: string | null) => {
      if (settled) return;
      if (st && st !== state) {
        settled = true; cleanup();
        try { popup.close(); } catch {}
        reject(new Error("OAuth state mismatch — login was tampered with"));
        return;
      }
      settled = true; cleanup();
      try { popup.close(); } catch {}
      try {
        const r = await fetch("/api/audius/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, codeVerifier, redirectUri: redirect }),
        });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error || "Audius token exchange failed");
        resolve(j.profile as AudiusProfile);
      } catch (e: any) {
        reject(new Error(e.message ?? String(e)));
      }
    };

    const onMessage = async (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.source !== "audius-oauth") return;
      if (d.error) {
        if (settled) return;
        settled = true; cleanup();
        try { popup.close(); } catch {}
        reject(new Error(String(d.error)));
        return;
      }
      if (!d.code) return;
      finishWithCode(String(d.code), d.state ? String(d.state) : null);
    };
    window.addEventListener("message", onMessage);

    // Fallback: poll localStorage in case postMessage was missed.
    pollTimer = setInterval(() => {
      if (settled) return;
      try {
        const raw = localStorage.getItem("audius-oauth-result");
        if (!raw) return;
        const p = JSON.parse(raw);
        localStorage.removeItem("audius-oauth-result");
        if (p.error) {
          settled = true; cleanup();
          try { popup.close(); } catch {}
          reject(new Error(String(p.error)));
          return;
        }
        if (p.code) finishWithCode(String(p.code), p.state ? String(p.state) : null);
      } catch { /* ignore parse errors */ }
    }, 500);

    closeTimer = setInterval(() => {
      if (popup.closed && !settled) {
        settled = true; cleanup();
        reject(new Error("Audius login window was closed"));
      }
    }, 500);

    try {
      const challenge = await pkceChallenge(codeVerifier);
      // audius.co/oauth/authorize is the legacy path; the current canonical
      // URL is audius.co/oauth/auth. api.audius.co/v1/oauth/authorize also
      // redirects here. Use the direct path to avoid the extra redirect.
      const url = new URL("https://audius.co/oauth/auth");
      url.searchParams.set("scope", "read");
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", redirect);
      url.searchParams.set("origin", origin);
      url.searchParams.set("response_mode", "query");
      url.searchParams.set("app_name", APP_NAME);
      if (API_KEY) url.searchParams.set("api_key", API_KEY);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("display", "popup");
      try { popup.location.href = url.toString(); } catch { /* cross-origin once Audius redirects */ }
    } catch (e: any) {
      if (!settled) {
        settled = true; cleanup();
        try { popup.close(); } catch {}
        reject(new Error(e.message ?? String(e)));
      }
    }
  });
}
