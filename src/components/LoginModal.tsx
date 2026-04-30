"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/lib/store";
import { WALLETS, connectWallet, type WalletId } from "@/lib/wallet";
import { loginWithAudius } from "@/lib/audiusOAuth";
import { Music, TrendingUp, ShieldCheck, ChevronLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Step = "ROLE" | "WALLET" | "AUDIUS" | "DONE";
type Role = "ARTIST" | "INVESTOR";

const spring = { type: "spring", stiffness: 500, damping: 35 } as const;
const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.2 } };

export function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { address, audius, setSession } = useSession();
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState<Step>("ROLE");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) { setRole(null); setStep("ROLE"); setErr(null); setBusy(null); }
  }, [isOpen]);

  // Auto-advance: investor + wallet → done
  useEffect(() => {
    if (!isOpen) return;
    if (role === "INVESTOR" && address && step === "WALLET") {
      setStep("DONE");
      setTimeout(onClose, 600);
    }
  }, [address, role, step, isOpen, onClose]);

  // Auto-advance: artist + wallet + audius → done
  useEffect(() => {
    if (!isOpen) return;
    if (role === "ARTIST" && address && audius && step === "AUDIUS") {
      setStep("DONE");
      setTimeout(onClose, 600);
    }
  }, [address, audius, role, step, isOpen, onClose]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const handleRole = useCallback((r: Role) => {
    setRole(r);
    setStep("WALLET");
    setErr(null);
  }, []);

  const handleWallet = useCallback(async (id: WalletId) => {
    setBusy(id);
    setErr(null);
    try {
      const r = await connectWallet(id);
      setSession({ address: r.address, kind: r.kind, provider: r.provider });
      if (role === "ARTIST") setStep("AUDIUS");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }, [role, setSession]);

  const handleAudius = useCallback(async () => {
    setBusy("audius");
    setErr(null);
    try {
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Login timed out — try again")), 90_000));
      const profile = await Promise.race([loginWithAudius(), timeout]);
      setSession({ audius: profile as any });
      if (address) {
        fetch("/api/audius/link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: address, walletType: "solana", profile, role: "ARTIST" }),
        }).catch(() => {});
      }
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }, [address, setSession]);

  const handleByHandle = useCallback(async (handle: string) => {
    const h = handle.replace(/^@/, "").trim();
    if (!h) { setErr("Enter your Audius @handle"); return; }
    setBusy("handle");
    setErr(null);
    try {
      const r = await fetch(`/api/audius/profile?handle=${encodeURIComponent(h)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Audius user not found");
      setSession({ audius: j.profile as any });
      if (address) {
        fetch("/api/audius/link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: address, walletType: "solana", profile: j.profile, role: "ARTIST" }),
        }).catch(() => {});
      }
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }, [address, setSession]);

  if (!isOpen) return null;

  const stepIndex = step === "ROLE" ? 0 : step === "WALLET" ? 1 : step === "AUDIUS" ? 2 : 3;
  const totalSteps = role === "ARTIST" ? 3 : 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-ink/30 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={spring}
          className="panel p-0 w-[440px] max-w-full relative shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          {step !== "DONE" && (
            <div className="h-0.5 bg-edge">
              <motion.div
                className="h-full bg-neon"
                initial={{ width: 0 }}
                animate={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          )}

          <div className="p-6">
            {/* Back + Close */}
            <div className="flex items-center justify-between mb-5">
              {step !== "ROLE" && step !== "DONE" ? (
                <button
                  onClick={() => setStep(step === "AUDIUS" ? "WALLET" : "ROLE")}
                  className="text-mute hover:text-ink transition flex items-center gap-1 text-sm"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              ) : <span />}
              {step !== "DONE" && (
                <button onClick={onClose} className="text-mute hover:text-ink transition text-lg leading-none">×</button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {/* ─── Step 1: Role ─────────────────── */}
              {step === "ROLE" && (
                <motion.div key="role" {...fade} className="space-y-5">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold tracking-tight">Welcome to SONGDAQ</h2>
                    <p className="text-mute text-sm mt-1">How would you like to participate?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <RoleCard
                      icon={<TrendingUp size={24} />}
                      label="Investor"
                      desc="Trade song tokens"
                      color="neon"
                      onClick={() => handleRole("INVESTOR")}
                    />
                    <RoleCard
                      icon={<Music size={24} />}
                      label="Artist"
                      desc="Tokenize your music"
                      color="violet"
                      onClick={() => handleRole("ARTIST")}
                    />
                  </div>
                </motion.div>
              )}

              {/* ─── Step 2: Wallet ──────────────── */}
              {step === "WALLET" && (
                <motion.div key="wallet" {...fade} className="space-y-5">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold tracking-tight">Connect Wallet</h2>
                    <p className="text-mute text-sm mt-1">
                      {role === "ARTIST" ? "Step 1 of 2 — sign with your wallet" : "Choose your wallet to get started"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {WALLETS.filter(w => w.kind === "solana").map(w => (
                      <WalletRow key={w.id} w={w} busy={busy === w.id} onConnect={() => handleWallet(w.id)} />
                    ))}
                  </div>
                  {WALLETS.some(w => w.kind === "evm") && (
                    <>
                      <div className="flex items-center gap-3 text-xs text-mute">
                        <span className="flex-1 h-px bg-edge" />
                        <span>EVM</span>
                        <span className="flex-1 h-px bg-edge" />
                      </div>
                      <div className="space-y-2">
                        {WALLETS.filter(w => w.kind === "evm").map(w => (
                          <WalletRow key={w.id} w={w} busy={busy === w.id} onConnect={() => handleWallet(w.id)} />
                        ))}
                      </div>
                    </>
                  )}
                  {err && <ErrorBanner message={err} />}
                </motion.div>
              )}

              {/* ─── Step 3: Audius (artist only) ── */}
              {step === "AUDIUS" && (
                <motion.div key="audius" {...fade}>
                  <AudiusStep
                    busy={busy}
                    err={err}
                    onOAuth={handleAudius}
                    onHandle={handleByHandle}
                  />
                </motion.div>
              )}

              {/* ─── Done ────────────────────────── */}
              {step === "DONE" && (
                <motion.div key="done" {...fade} className="text-center py-4 space-y-3">
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                  >
                    <CheckCircle2 size={48} className="text-neon mx-auto" />
                  </motion.div>
                  <h2 className="text-xl font-semibold">You&apos;re in</h2>
                  <p className="text-mute text-sm">
                    {role === "ARTIST" ? "Artist mode activated. Go launch a token." : "Welcome aboard. Start exploring the market."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Sub-components ──────────────────────────────────── */

function RoleCard({ icon, label, desc, color, onClick }: {
  icon: React.ReactNode; label: string; desc: string; color: "neon" | "violet"; onClick: () => void;
}) {
  const border = color === "neon" ? "hover:border-neon" : "hover:border-violet";
  const bg = color === "neon" ? "hover:bg-neon/5" : "hover:bg-violet/5";
  const text = color === "neon" ? "text-neon" : "text-violet";
  const groupText = color === "neon" ? "group-hover:text-neon" : "group-hover:text-violet";

  return (
    <button
      onClick={onClick}
      className={`bg-panel2 border border-edge rounded-xl p-5 text-left ${border} ${bg} transition-all group active:scale-[0.97]`}
    >
      <div className={`${text} mb-3`}>{icon}</div>
      <div className={`font-semibold text-base ${groupText} transition`}>{label}</div>
      <div className="text-xs text-mute mt-1">{desc}</div>
    </button>
  );
}

function WalletRow({ w, busy, onConnect }: { w: any; busy: boolean; onConnect: () => void }) {
  const installed = w.installed();
  return (
    <button
      onClick={installed ? onConnect : () => window.open(w.installUrl, "_blank")}
      className="w-full bg-panel2 border border-edge hover:border-neon/40 text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all group active:scale-[0.98]"
      disabled={busy}
    >
      <span className="font-medium text-sm group-hover:text-neon transition">{w.label}</span>
      <span className="text-xs text-mute">
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : installed ? "Connect →" : "Install ↗"}
      </span>
    </button>
  );
}

function AudiusStep({ busy, err, onOAuth, onHandle }: {
  busy: string | null; err: string | null;
  onOAuth: () => void; onHandle: (h: string) => void;
}) {
  const [handle, setHandle] = useState("");

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-12 h-12 bg-violet/10 text-violet rounded-full flex items-center justify-center mx-auto mb-3">
          <ShieldCheck size={24} />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Verify with Audius</h2>
        <p className="text-mute text-sm mt-1">Step 2 of 2 — prove you own your tracks</p>
      </div>

      <button
        className="bg-violet hover:bg-violet/90 text-pure-white font-medium py-3 px-6 rounded-xl w-full transition-all active:scale-[0.97] disabled:opacity-50"
        onClick={onOAuth}
        disabled={busy === "audius"}
      >
        {busy === "audius" ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Opening Audius…
          </span>
        ) : "Sign in with Audius"}
      </button>

      <div className="flex items-center gap-3 text-xs text-mute">
        <span className="flex-1 h-px bg-edge" />
        <span>or paste your handle</span>
        <span className="flex-1 h-px bg-edge" />
      </div>

      <div className="flex gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onHandle(handle)}
          placeholder="@your-handle"
          className="flex-1 text-sm"
          autoFocus
        />
        <button
          className="btn"
          onClick={() => onHandle(handle)}
          disabled={!!busy || !handle.trim()}
        >
          {busy === "handle" ? <Loader2 size={14} className="animate-spin" /> : "Link"}
        </button>
      </div>

      <p className="text-[11px] text-mute leading-relaxed">
        OAuth opens Audius in a popup. If blocked, paste your handle to link your public profile instead.
      </p>

      {err && <ErrorBanner message={err} />}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="flex items-start gap-2 text-red text-xs p-3 bg-red/5 border border-red/20 rounded-lg"
    >
      <AlertCircle size={14} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </motion.div>
  );
}
