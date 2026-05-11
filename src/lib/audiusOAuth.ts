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

async function exchangeCodeForProfile(code: string, codeVerifier: string, redirectUri: string, timeoutMs = 18_000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("/api/audius/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, codeVerifier, redirectUri }),
      signal: ctrl.signal,
    });
    const j = await readJsonResponse(r);
    if (!r.ok || !j.ok) throw new Error(j.error || "Audius token exchange failed");
    return j.profile as AudiusProfile;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Audius sign-in is taking too long. Please retry in a moment.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text.trim()) {
    if (res.ok) return {};
    throw new Error(`Audius exchange returned an empty response (${res.status}). Please retry sign-in.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Audius exchange returned an unreadable response (${res.status}). Please retry sign-in.`);
  }
}

function randomString(len = 64): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] % 36).toString(36);
  return s;
}

function clearAudiusOAuthStorage() {
  try {
    sessionStorage.removeItem("audius-pkce-verifier");
    sessionStorage.removeItem("audius-pkce-state");
    sessionStorage.removeItem("audius-pkce-redirect");
    sessionStorage.removeItem("audius-pkce-return");
    localStorage.removeItem("audius-pkce-verifier");
    localStorage.removeItem("audius-pkce-state");
    localStorage.removeItem("audius-pkce-redirect");
    localStorage.removeItem("audius-pkce-return");
    localStorage.removeItem("audius-oauth-result");
    localStorage.removeItem("audius-oauth-profile");
  } catch {}
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

async function buildAudiusAuthorizeUrl(display: "popup" | "fullScreen" = "popup") {
  if (!API_KEY) {
    throw new Error("Audius sign-in is not configured yet. Add NEXT_PUBLIC_AUDIUS_API_KEY to your environment, then restart the app.");
  }

  const state = randomString(24);
  const codeVerifier = randomString(64);
  const origin = window.location.origin;
  const redirect = `${origin}/audius/callback`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const returnTo = window.location.pathname.startsWith("/audius/callback") ? "/market" : currentPath;

  clearAudiusOAuthStorage();
  try {
    sessionStorage.setItem("audius-pkce-verifier", codeVerifier);
    sessionStorage.setItem("audius-pkce-state", state);
    sessionStorage.setItem("audius-pkce-redirect", redirect);
    sessionStorage.setItem("audius-pkce-return", returnTo);
    localStorage.setItem("audius-pkce-verifier", codeVerifier);
    localStorage.setItem("audius-pkce-state", state);
    localStorage.setItem("audius-pkce-redirect", redirect);
    localStorage.setItem("audius-pkce-return", returnTo);
  } catch {}

  const challenge = await pkceChallenge(codeVerifier);
  const url = new URL("https://api.audius.co/v1/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "read");
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("display", display);
  return url.toString();
}

export async function redirectToAudiusLogin() {
  if (typeof window === "undefined") throw new Error("client only");
  const url = await buildAudiusAuthorizeUrl("fullScreen");
  window.location.assign(url);
}

export function loginWithAudius(): Promise<AudiusProfile> {
  if (typeof window === "undefined") return Promise.reject(new Error("client only"));
  if (!API_KEY) {
    return Promise.reject(
      new Error("Audius sign-in is not configured yet. Add NEXT_PUBLIC_AUDIUS_API_KEY to your environment, then restart the app."),
    );
  }
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
    let expectedState = "";
    let codeVerifier = "";
    let redirect = `${window.location.origin}/audius/callback`;
    let settled = false;
    let closeTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (closeTimer) clearInterval(closeTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (hardTimer) clearTimeout(hardTimer);
    };

    const finishWithCode = async (code: string, st: string | null) => {
      if (settled) return;
      if (st && expectedState && st !== expectedState) {
        settled = true; cleanup();
        try { popup.close(); } catch {}
        reject(new Error("OAuth state mismatch — login was tampered with"));
        return;
      }
      settled = true; cleanup();
      try {
        const profile = await exchangeCodeForProfile(code, codeVerifier, redirect);
        try { popup.close(); } catch {}
        resolve(profile);
      } catch (e: any) {
        try {
          const raw = localStorage.getItem("audius-oauth-profile");
          const fallback = raw ? JSON.parse(raw) : null;
        if (fallback?.profile && (!fallback.state || !expectedState || fallback.state === expectedState)) {
            try { popup.close(); } catch {}
            resolve(fallback.profile as AudiusProfile);
            return;
          }
        } catch {}
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

    hardTimer = setTimeout(() => {
      if (settled) return;
      settled = true; cleanup();
      try { popup.close(); } catch {}
      reject(new Error("Audius login timed out. Make sure the callback URL is registered in Audius, then retry."));
    }, 45_000);

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
        if (p.profile) {
          if (p.state && expectedState && p.state !== expectedState) {
            settled = true; cleanup();
            try { popup.close(); } catch {}
            reject(new Error("OAuth state mismatch — login was tampered with"));
            return;
          }
          settled = true; cleanup();
          try { popup.close(); } catch {}
          resolve(p.profile as AudiusProfile);
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
      const url = await buildAudiusAuthorizeUrl("popup");
      expectedState = localStorage.getItem("audius-pkce-state") || "";
      codeVerifier = localStorage.getItem("audius-pkce-verifier") || "";
      redirect = localStorage.getItem("audius-pkce-redirect") || redirect;
      try { popup.location.href = url; } catch { /* cross-origin once Audius redirects */ }
    } catch (e: any) {
      if (!settled) {
        settled = true; cleanup();
        try { popup.close(); } catch {}
        reject(new Error(e.message ?? String(e)));
      }
    }
  });
}
