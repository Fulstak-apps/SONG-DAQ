"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { redirectToAudiusLogin } from "@/lib/audiusOAuth";
import { useSession } from "@/lib/store";
import { SafeImage } from "./SafeImage";
import { ShieldCheck, Loader2, X } from "lucide-react";

export function AudiusLoginButton({ compact = false }: { compact?: boolean }) {
  const { audius, clear } = useSession();
  const [busy, setBusy] = useState<"oauth" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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

  async function loginOAuth() {
    setBusy("oauth"); setErr(null);
    try {
      await redirectToAudiusLogin();
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setBusy(null);
    } finally {
      // On success the browser navigates to Audius.
    }
  }

  if (!mounted) {
    return <button className="btn text-[10px] font-bold uppercase tracking-widest">Sign in with Audius</button>;
  }

  if (audius) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <a
            href={audius.handle ? `https://audius.co/${audius.handle}` : "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-violet/30 bg-violet/10 px-2 py-1.5 text-violet backdrop-blur-md transition hover:bg-violet/14 min-w-0 max-w-[260px]"
            title={`${audius.name} (@${audius.handle})`}
          >
            <span className="relative shrink-0 overflow-hidden rounded-full border border-violet/25 bg-violet/18 h-7 w-7">
              {audius.avatar ? (
                <SafeImage
                  src={audius.avatar}
                  alt={audius.handle}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="grid place-items-center rounded-full bg-violet/20 font-black text-violet h-7 w-7 text-[10px]">
                  {(audius.name || audius.handle || "A").charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="min-w-0 whitespace-normal break-words text-[9px] font-black uppercase tracking-[0.12em] leading-tight text-violet/90">
              {audius.name || `@${audius.handle}`}
            </span>
            {audius.verified && <ShieldCheck size={11} className="shrink-0 text-violet" />}
          </a>
          <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.055] border border-edge text-mute hover:text-ink hover:bg-white/[0.09] transition shrink-0" onClick={clear} title="Disconnect all wallets and sign out">
            <X size={10} />
          </button>
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-2 min-w-0 ${compact ? "max-w-[120px]" : "max-w-[180px] xl:max-w-[240px]"}`}>
        <a
          href={audius.handle ? `https://audius.co/${audius.handle}` : "#"}
          target="_blank"
          rel="noreferrer"
          className={`flex min-w-0 items-center rounded-2xl border border-violet/30 bg-violet/10 text-[10px] text-violet backdrop-blur-md transition hover:bg-violet/14 ${compact ? "gap-2 px-2 py-1.5" : "gap-2.5 px-2.5 py-1.5"}`}
          title={`${audius.name} (@${audius.handle})`}
        >
            <span className={`relative shrink-0 overflow-hidden rounded-full border border-violet/25 bg-violet/18 ${compact ? "h-7 w-7" : "h-8 w-8"}`}>
              {audius.avatar ? (
                <SafeImage
                  src={audius.avatar}
                  alt={audius.handle}
                  width={32}
                  height={32}
                  className={`${compact ? "h-7 w-7" : "h-8 w-8"} rounded-full object-cover`}
                />
              ) : (
              <span className={`grid place-items-center rounded-full bg-violet/20 font-black text-violet ${compact ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]"}`}>
                {(audius.name || audius.handle || "A").charAt(0).toUpperCase()}
              </span>
              )}
            </span>
          {compact ? (
              <span className="min-w-0 flex-1 max-w-[150px] whitespace-normal break-words text-[9px] font-black uppercase tracking-[0.12em] text-violet/90 leading-tight">
                {audius.name || `@${audius.handle}`}
              </span>
            ) : (
              <span className="min-w-0 flex-1">
              <span className="block whitespace-normal break-words text-[11px] font-black text-ink leading-tight">
                {audius.name || `@${audius.handle}`}
              </span>
              <span className="block truncate text-[9px] uppercase tracking-widest text-violet/85">
                @{audius.handle}
              </span>
            </span>
          )}
          {audius.verified && <ShieldCheck size={12} className="shrink-0 text-violet" />}
        </a>
        <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.055] border border-edge text-mute hover:text-ink hover:bg-white/[0.09] transition shrink-0" onClick={clear} title="Disconnect all wallets and sign out">
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
            className="absolute right-0 top-11 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-2xl border border-edge bg-panel backdrop-blur-3xl p-4 z-40 shadow-[0_20px_40px_rgba(0,0,0,0.6)] text-ink"
          >
            <div className="label mb-3">Connect your Audius identity</div>
            <button
              className="btn-primary w-full mb-3 text-[10px] font-black uppercase tracking-widest"
              onClick={loginOAuth}
              disabled={!!busy}
            >
              {busy === "oauth" ? <><Loader2 size={12} className="animate-spin" /> Opening Audius…</> : "Sign in with Audius (popup)"}
            </button>
            <p className="text-[10px] text-mute mt-3 leading-relaxed">
              OAuth opens Audius in a popup. Artist launch access requires verified Audius sign-in through the official connection flow.
            </p>
            {err && <div className="text-red text-[10px] mt-2 bg-red/5 border border-red/10 rounded-lg px-3 py-2 font-bold">{err}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
