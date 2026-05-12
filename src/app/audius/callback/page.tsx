"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useSession, useUI, type AudiusProfile } from "@/lib/store";

type Status = "loading" | "success" | "error";

async function readExchangeJson(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Audius returned an unreadable response (${res.status}). Please retry sign-in.`);
  }
}

/**
 * OAuth 2.0 PKCE callback. Audius redirects here with `?code=...&state=...`
 * (or `?error=...`). We forward the values to the opener via postMessage AND
 * via localStorage so the opener has a fallback delivery channel.
 */
export default function AudiusCallback() {
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("Finalizing your Audius sign-in...");
  const setSession = useSession((s) => s.setSession);
  const setUserMode = useUI((s) => s.setUserMode);

  useEffect(() => {
    let cancelled = false;

    async function exchangeInCallback(code: string, state: string | null) {
      const expectedState = sessionStorage.getItem("audius-pkce-state") || localStorage.getItem("audius-pkce-state");
      if (expectedState && state && expectedState !== state) {
        throw new Error("OAuth state mismatch. Please retry Audius sign-in.");
      }

      const codeVerifier = sessionStorage.getItem("audius-pkce-verifier") || localStorage.getItem("audius-pkce-verifier");
      const redirectUri = sessionStorage.getItem("audius-pkce-redirect") || localStorage.getItem("audius-pkce-redirect") || `${window.location.origin}/audius/callback`;
      if (!codeVerifier) throw new Error("Missing Audius login verifier. Please return to SONG·DAQ and retry sign-in.");

      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 22_000);
      try {
        const r = await fetch("/api/audius/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, codeVerifier, redirectUri }),
          signal: ctrl.signal,
        });
        const j = await readExchangeJson(r);
        if (!r.ok || !j.ok || !j.profile) throw new Error(j.error || "Audius token exchange failed.");
        return j.profile as AudiusProfile;
      } catch (e: any) {
        if (e?.name === "AbortError") {
          throw new Error("Audius sign-in is taking too long. Please retry in a moment.");
        }
        throw e;
      } finally {
        clearTimeout(id);
      }
    }

    function cleanupOAuthStorage() {
      try {
        sessionStorage.removeItem("audius-pkce-verifier");
        sessionStorage.removeItem("audius-pkce-state");
        sessionStorage.removeItem("audius-pkce-redirect");
        sessionStorage.removeItem("audius-pkce-return");
        localStorage.removeItem("audius-pkce-verifier");
        localStorage.removeItem("audius-pkce-state");
        localStorage.removeItem("audius-pkce-redirect");
        localStorage.removeItem("audius-pkce-return");
      } catch {}
    }

    function linkAudiusInBackground(sol: string, profile: AudiusProfile) {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 2_000);
      fetch("/api/audius/link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: sol, walletType: "solana", profile, role: "ARTIST" }),
          signal: ctrl.signal,
        })
        .catch((error) => {
        console.warn("Audius link deferred", error);
        })
        .finally(() => clearTimeout(id));
    }

    async function run() {
      try {
      const url = new URL(window.location.href);
      const q = Object.fromEntries(url.searchParams.entries());
      const frag = Object.fromEntries(new URLSearchParams(url.hash.replace(/^#/, "")).entries());
      const params: Record<string, string> = { ...frag, ...q };
      const code = params.code ?? null;
      const state = params.state ?? null;
      const error = params.error ?? params.error_description ?? null;

      const payload = { source: "audius-oauth", code, state, error, raw: params, ts: Date.now() };
      try { localStorage.setItem("audius-oauth-result", JSON.stringify(payload)); } catch {}

      if (error) {
        setStatus("error");
        setMsg(`Audius returned an error: ${error}`);
        if (window.opener && !window.opener.closed) {
          try { window.opener.postMessage(payload, window.location.origin); } catch {}
        }
        return;
      }

      if (!code) {
        setStatus("error");
        setMsg("Audius did not return a login code. Please retry sign-in from SONG·DAQ.");
        return;
      }

      if (!window.opener || window.opener.closed) {
        setMsg("Audius connected. Finalizing your SONG·DAQ session...");
        const profile = await exchangeInCallback(String(code), state ? String(state) : null);
        if (cancelled) return;
        const sol = profile.wallets?.sol ?? null;
        const current = useSession.getState();
        const hasExternalWallet = !!current.address && current.provider !== "audius";
        const linkWallet = hasExternalWallet ? current.address : sol;
        setSession(hasExternalWallet ? { audius: profile } : { audius: profile, address: null, kind: null, provider: null });
        setUserMode("ARTIST");
        try {
          localStorage.setItem("audius-oauth-profile", JSON.stringify({ source: "audius-oauth", state, profile, ts: Date.now() }));
        } catch {}
        if (linkWallet) linkAudiusInBackground(linkWallet, profile);
        cleanupOAuthStorage();
        setStatus("success");
        setMsg("Audius connected. Returning to SONG·DAQ...");
        setTimeout(() => {
          window.location.replace("/market?artistWallet=1");
        }, 700);
      } else {
        setStatus("success");
        setMsg("Audius connected. Returning control to SONG·DAQ...");
        try { window.opener.postMessage(payload, window.location.origin); } catch {}
        // Do not exchange the code here when an opener exists. OAuth codes are
        // one-use only; the parent window owns the exchange to avoid racing and
        // causing Audius invalid_grant errors.
        setTimeout(() => {
          try { window.opener?.postMessage(payload, window.location.origin); } catch {}
        }, 500);
        setTimeout(() => window.close(), 1200);
      }
    } catch (e: any) {
      cleanupOAuthStorage();
      setStatus("error");
      setMsg(`Audius callback error: ${e?.message ?? String(e)}`);
    }
    }

    run();
    return () => { cancelled = true; };
  }, [setSession, setUserMode]);

  const icon = useMemo(() => {
    if (status === "loading") return <Loader2 size={32} className="animate-spin text-violet" />;
    if (status === "success") return <CheckCircle2 size={32} className="text-neon" />;
    return <XCircle size={32} className="text-red" />;
  }, [status]);

  return (
    <main className="min-h-screen bg-bg text-ink relative overflow-hidden">
      <div className="orb orb-violet w-[280px] h-[280px] -top-16 -right-10 opacity-30" />
      <div className="orb orb-neon w-[260px] h-[260px] -bottom-20 -left-12 opacity-20" />

      <div className="relative z-10 min-h-screen px-6 py-10 grid place-items-center">
        <section className="w-full max-w-xl panel-elevated p-8 md:p-10 text-center grain">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-edge bg-panel2 shadow-sm">
            {icon}
          </div>

          <div className="text-[10px] uppercase tracking-[0.28em] font-black text-mute">Audius OAuth</div>
          <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-white">
            {status === "error" ? "Connection Interrupted" : "Securing Artist Access"}
          </h1>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-mute max-w-lg mx-auto">
            {msg}
          </p>

          <div className="mt-8 rounded-2xl border border-edge bg-panel p-5 text-left space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-neon shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-black text-white tracking-tight">Why this window exists</div>
                <p className="mt-1 text-sm text-mute leading-relaxed">
                  SONG·DAQ uses your Audius identity to verify artist access and pass the result back to the app. This window should close automatically once the handshake completes.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-edge bg-panel2 p-4">
                <div className="text-[10px] uppercase tracking-widest font-black text-violet">Status</div>
                <div className="mt-2 text-sm font-bold text-white">
                  {status === "loading" ? "Connecting..." : status === "success" ? "Connected" : "Needs Attention"}
                </div>
              </div>
              <div className="rounded-xl border border-edge bg-panel2 p-4">
                <div className="text-[10px] uppercase tracking-widest font-black text-neon">Next Step</div>
                <div className="mt-2 text-sm font-bold text-white">
                  {status === "error" ? "Retry sign-in" : "Return to SONG·DAQ"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-[11px] uppercase tracking-widest font-bold text-mute">
            SONG·DAQ · Audius · Solana
          </div>

          {status === "error" && (
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.replace("/market")}
                className="btn-primary px-5 py-3 text-[10px] uppercase tracking-widest font-black"
              >
                Return to SONG·DAQ
              </button>
              <button
                type="button"
                onClick={() => window.location.replace("/market?login=artist")}
                className="btn px-5 py-3 text-[10px] uppercase tracking-widest font-black"
              >
                Retry Audius Login
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
