"use client";
import { useEffect, useState } from "react";

/**
 * OAuth 2.0 PKCE callback. Audius redirects here with `?code=…&state=…`
 * (or `?error=…`). We forward the values to the opener via postMessage AND
 * via localStorage so the opener has a fallback delivery channel.
 */
export default function AudiusCallback() {
  const [msg, setMsg] = useState("Connecting to Audius…");

  useEffect(() => {
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

      if (window.opener && !window.opener.closed) {
        try { window.opener.postMessage(payload, window.location.origin); } catch {}
        setMsg(error ? `Audius error: ${error}` : "Connected — closing window…");
        setTimeout(() => window.close(), 300);
      } else {
        setMsg(error
          ? `Audius error: ${error}. You can close this window.`
          : "Connected. Return to Song DAQ — you may close this window.");
      }
    } catch (e: any) {
      setMsg(`Audius callback error: ${e?.message ?? String(e)}`);
    }
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", color: "#0b1220", background: "#f7f8fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "10vh auto", textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: 1.2, color: "#6b7785", textTransform: "uppercase" }}>Audius OAuth</div>
        <div style={{ marginTop: 8, fontSize: 16 }}>{msg}</div>
      </div>
    </div>
  );
}
