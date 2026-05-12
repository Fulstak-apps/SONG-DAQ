"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { safeJson } from "@/lib/safeJson";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => safeJson(r))
      .then((j) => {
        setEnabled(Boolean(j.passwordLoginEnabled));
        if (j.authenticated) router.replace("/admin");
      })
      .catch(() => setEnabled(false));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json: any = await safeJson(res);
      if (!res.ok) throw new Error(json.error || "Admin login failed");
      router.replace("/admin");
    } catch (error: any) {
      setErr(error.message || "Admin login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[70vh] grid place-items-center px-3">
      <form onSubmit={submit} className="panel w-full max-w-md p-6 md:p-8 space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-neon/10 border border-neon/20 grid place-items-center text-neon">
          <Lock size={20} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] font-black text-mute">song-daq admin</div>
          <h1 className="mt-2 text-3xl font-black text-ink">Operations Login</h1>
          <p className="mt-2 text-sm text-mute leading-relaxed">
            Admin access is protected by server-side credentials and role checks. The subtle Support-page Admin link is only a doorway, not security.
          </p>
        </div>

        {!enabled && (
          <div className="rounded-2xl border border-amber/25 bg-amber/10 p-4 text-sm text-amber leading-relaxed">
            Admin password login is not configured. Set <span className="font-mono">ADMIN_USERNAME</span>, <span className="font-mono">ADMIN_PASSWORD</span>, and <span className="font-mono">ADMIN_SESSION_SECRET</span> on the server.
          </div>
        )}

        <label className="block space-y-2">
          <span className="text-[11px] uppercase tracking-widest font-black text-mute">Admin username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-2xl border border-edge bg-panel2 px-4 py-3 text-ink outline-none focus:border-neon/40"
            autoComplete="username"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-[11px] uppercase tracking-widest font-black text-mute">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-edge bg-panel2 px-4 py-3 text-ink outline-none focus:border-neon/40"
            type="password"
            autoComplete="current-password"
          />
        </label>

        {err && <div className="rounded-xl border border-red/25 bg-red/10 px-4 py-3 text-sm text-red">{err}</div>}

        <button
          disabled={loading || !enabled || !username || !password}
          className="btn-primary w-full h-12 text-[11px] uppercase tracking-widest font-black disabled:opacity-40"
        >
          {loading ? "Checking..." : "Open Admin Dashboard"}
        </button>
        <div className="flex items-start gap-2 text-xs text-mute leading-relaxed">
          <ShieldCheck size={14} className="mt-0.5 text-neon shrink-0" />
          Never put admin credentials or treasury private keys in frontend code.
        </div>
      </form>
    </main>
  );
}
