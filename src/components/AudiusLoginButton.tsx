"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loginWithAudius } from "@/lib/audiusOAuth";
import { useSession, type AudiusProfile } from "@/lib/store";
import { SafeImage } from "./SafeImage";
import { ShieldCheck, ExternalLink, Loader2, X } from "lucide-react";

export function AudiusLoginButton() {
  const { audius, address, kind, setSession, clearAudius } = useSession();
  const [busy, setBusy] = useState<"oauth" | "handle" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function persistLink(profile: AudiusProfile) {
    setSession({ audius: profile });
    if (address) {
      await fetch("/api/audius/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address, walletType: kind, profile }),
      }).catch(() => {});
    }
  }

  async function loginOAuth() {
    setBusy("oauth"); setErr(null);
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("Login timed out — try the handle option below")), 90_000),
    );
    try {
      const profile = (await Promise.race([loginWithAudius(), timeout])) as AudiusProfile;
      await persistLink(profile);
      setOpen(false);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function loginByHandle() {
    const h = handle.replace(/^@/, "").trim();
    if (!h) { setErr("Enter your Audius @handle"); return; }
    setBusy("handle"); setErr(null);
    try {
      const r = await fetch(`/api/audius/profile?handle=${encodeURIComponent(h)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Audius user not found");
      await persistLink(j.profile as AudiusProfile);
      setHandle("");
      setOpen(false);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!mounted) {
    return <button className="btn text-[10px] font-bold uppercase tracking-widest">Sign in with Audius</button>;
  }

  if (audius) {
    return (
      <div className="flex items-center gap-2 max-w-[200px]">
        <a
          href={audius.handle ? `https://audius.co/${audius.handle}` : "#"}
          target="_blank"
          rel="noreferrer"
          className="chip-violet flex items-center gap-1.5 overflow-hidden text-[10px]"
          title={`${audius.name} (@${audius.handle})`}
        >
          {audius.avatar
            ? <SafeImage src={audius.avatar} alt={audius.handle} width={16} height={16} className="rounded-full shrink-0" />
            : <span className="w-2 h-2 rounded-full bg-violet shadow-[0_0_4px_rgba(155,81,224,0.5)] shrink-0" />}
          <span className="truncate max-w-[120px] font-bold">
            {audius.name || `@${audius.handle}`}
          </span>
          {audius.verified && <ShieldCheck size={10} className="text-violet shrink-0" />}
        </a>
        <button className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.04] text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition shrink-0" onClick={clearAudius} title="Sign out of Audius">
          <X size={10} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn text-[10px] font-bold uppercase tracking-widest"
        onClick={() => setOpen((v) => !v)}
        disabled={busy === "oauth"}
        title="Sign in with Audius"
      >
        {busy === "oauth" ? <><Loader2 size={12} className="animate-spin" /> Connecting…</> : "Sign in with Audius"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, scale: 0.97, filter: "blur(2px)" }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="absolute right-0 top-11 w-80 rounded-2xl border border-white/[0.06] bg-[var(--glass-bg-elevated)] backdrop-blur-3xl p-4 z-40 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
          >
            <div className="label mb-3">Connect your Audius identity</div>
            <button
              className="btn-primary w-full mb-3 text-[10px] font-black uppercase tracking-widest"
              onClick={loginOAuth}
              disabled={!!busy}
            >
              {busy === "oauth" ? <><Loader2 size={12} className="animate-spin" /> Opening Audius…</> : "Sign in with Audius (popup)"}
            </button>
            <div className="flex items-center gap-3 text-[9px] text-white/15 uppercase tracking-widest font-bold">
              <span className="flex-1 h-px bg-white/[0.04]" />
              <span>or paste handle</span>
              <span className="flex-1 h-px bg-white/[0.04]" />
            </div>
            <div className="flex gap-1.5 mt-3">
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loginByHandle()}
                placeholder="@your-audius-handle"
                className="flex-1 text-sm !rounded-xl"
                autoFocus
              />
              <button
                className="btn text-[10px] font-bold uppercase tracking-widest"
                onClick={loginByHandle}
                disabled={!!busy || !handle.trim()}
              >{busy === "handle" ? <Loader2 size={12} className="animate-spin" /> : "Link"}</button>
            </div>
            <p className="text-[10px] text-white/15 mt-3 leading-relaxed">
              OAuth opens Audius in a popup. If blocked, paste your handle to link your public profile (read-only).
            </p>
            {err && <div className="text-red text-[10px] mt-2 bg-red/5 border border-red/10 rounded-lg px-3 py-2 font-bold">{err}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
