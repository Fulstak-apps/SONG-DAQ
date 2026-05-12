"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Loader2, ShieldCheck, X } from "lucide-react";
import { safeJson } from "@/lib/safeJson";

export function HiddenAdminAccess() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let sequence = "";
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      sequence = `${sequence}${e.key.toLowerCase()}`.slice(-10);
      if (sequence.endsWith("songadmin")) setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j: any = await safeJson(r);
      if (!r.ok) throw new Error(j.error || "Admin login failed");
      setOpen(false);
      router.push("/admin");
      router.refresh();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mobile-safe-overlay fixed inset-0 z-[120] grid place-items-center bg-black/65 backdrop-blur-xl"
          onClick={() => setOpen(false)}
        >
          <motion.form
            initial={{ scale: 0.96, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 14, opacity: 0 }}
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="mobile-safe-sheet w-full max-w-md overflow-y-auto rounded-3xl border border-edge bg-panel p-6 shadow-[0_0_80px_rgba(0,0,0,0.72)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-neon/20 bg-neon/10 text-neon">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.28em] text-mute">Private Access</div>
                <h2 className="mt-2 text-2xl font-black text-ink">Admin Login</h2>
                <p className="mt-2 text-sm leading-relaxed text-mute">
                  Sign in to open moderation, launch, report, and split operations.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn h-9 w-9 p-0">
                <X size={14} />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <label className="block">
                <span className="label">Admin name</span>
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-edge bg-panel2 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-neon/40"
                />
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-edge bg-panel2 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-neon/40"
                />
              </label>
            </div>

            {err && (
              <div className="mt-4 rounded-xl border border-red/20 bg-red/10 p-3 text-xs font-bold uppercase tracking-widest text-red">
                {err}
              </div>
            )}

            <button disabled={busy} className="btn-primary mt-5 h-12 w-full text-[11px] font-black uppercase tracking-widest">
              {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Checking</span> : <span className="inline-flex items-center gap-2"><Lock size={14} /> Open Admin</span>}
            </button>
            <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-widest text-mute">
              Shortcut: Control + Shift + A
            </p>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
