"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, useUI } from "@/lib/store";
import { WALLETS, connectWallet, disconnectWallet, type WalletId } from "@/lib/wallet";
import { redirectToAudiusLogin } from "@/lib/audiusOAuth";
import { safeJson } from "@/lib/safeJson";
import { Music, TrendingUp, ShieldCheck, ChevronLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/lib/toast";

type Step = "ROLE" | "WALLET" | "AUDIUS" | "ARTIST_READY" | "DONE";
type Role = "ARTIST" | "INVESTOR";

const spring = { type: "spring", stiffness: 500, damping: 35 } as const;
const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.2 } };

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { address, audius, setSession } = useSession();
  const { setUserMode } = useUI();
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState<Step>("ROLE");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    if (audius) {
      setRole("ARTIST");
      setStep("ARTIST_READY");
      setUserMode("ARTIST");
    } else {
      setRole(null);
      setStep("ROLE");
    }
    setErr(null);
    setBusy(null);
  }, [isOpen, audius, setUserMode]);

  // Auto-advance: investor + wallet → done
  useEffect(() => {
    if (!isOpen) return;
    if (role === "INVESTOR" && address && step === "WALLET") {
      setStep("DONE");
      setTimeout(onClose, 600);
    }
  }, [address, role, step, isOpen, onClose]);

  // Auto-advance: artist + Audius → ready; external wallet is optional.
  useEffect(() => {
    if (!isOpen) return;
    if (role === "ARTIST" && audius && step === "AUDIUS") {
      setStep("ARTIST_READY");
    }
  }, [audius, role, step, isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const handleRole = useCallback((r: Role) => {
    setRole(r);
    setUserMode(r);
    setStep(r === "ARTIST" ? "AUDIUS" : "WALLET");
    setErr(null);
  }, [setUserMode]);

  const handleWallet = useCallback(async (id: WalletId) => {
    setBusy(id);
    setErr(null);
    try {
      const r = await connectWallet(id);
      setSession({ address: r.address, kind: r.kind, provider: r.provider });
      if (role === "ARTIST" && audius) {
        const link = await fetchWithTimeout("/api/audius/link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: r.address, walletType: r.kind, profile: audius, role: "ARTIST" }),
        });
        if (!link.ok) {
          const j = await safeJson(link);
          toast.info("Wallet connected", (j as any).error || "Artist profile link is pending until the database is reachable.");
        } else {
          const j = await safeJson(link);
          if ((j as any)?.linkPending) {
            toast.info("Wallet connected", "Artist profile link is pending until the database is reachable.");
          }
        }
        setUserMode("ARTIST");
        setStep("DONE");
      } else {
        setStep("DONE");
      }
    } catch (e: any) {
      await disconnectWallet(id).catch(() => {});
      setErr(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }, [role, audius, setSession, setUserMode]);

  const handleAudius = useCallback(async () => {
    setBusy("audius");
    setErr(null);
    try {
      await redirectToAudiusLogin();
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setBusy(null);
    } finally {
      // On success the browser navigates to Audius, so leave the loading state
      // visible until the page changes.
    }
  }, []);

  if (!isOpen) return null;

  const stepIndex = step === "ROLE" ? 0 : step === "WALLET" || step === "AUDIUS" ? 1 : step === "ARTIST_READY" ? 2 : 3;
  const totalSteps = role === "ARTIST" ? 3 : 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] grid items-start justify-items-center overflow-y-auto bg-ink/30 backdrop-blur-sm p-2 sm:place-items-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={spring}
          className="panel p-0 w-full sm:w-[440px] max-w-full max-h-[calc(100dvh-1rem)] overflow-y-auto relative shadow-lg"
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

          <div className="p-4 sm:p-6">
            {/* Back + Close */}
            <div className="flex items-center justify-between mb-5">
              {step !== "ROLE" && step !== "DONE" ? (
                <button
                  onClick={() => setStep(step === "WALLET" && role === "ARTIST" ? "ARTIST_READY" : "ROLE")}
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
                    <h2 className="text-xl font-semibold tracking-tight">Welcome to SONG·DAQ</h2>
                    <p className="text-mute text-sm mt-1">How would you like to participate?</p>
                  </div>
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                    <RoleCard
                      icon={<TrendingUp size={24} />}
                      label="Investor"
                      desc="Connect Solana to trade"
                      color="neon"
                      onClick={() => handleRole("INVESTOR")}
                    />
                    <RoleCard
                      icon={<Music size={24} />}
                      label="Artist"
                      desc="Audius identity + investor access"
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
                    <h2 className="text-xl font-semibold tracking-tight">{role === "ARTIST" ? "Optional Wallet" : "Investor Wallet"}</h2>
                    <p className="text-mute text-sm mt-1">
                      {role === "ARTIST" ? "Attach an external Solana wallet if you do not want to use your Audius wallet." : "Choose a Solana wallet to trade"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {WALLETS.map(w => (
                      <WalletRow key={w.id} w={w} busy={busy === w.id} onConnect={() => handleWallet(w.id)} />
                    ))}
                  </div>
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
                  />
                </motion.div>
              )}

              {step === "ARTIST_READY" && (
                <motion.div key="artist-ready" {...fade} className="space-y-5 text-center">
                  <CheckCircle2 size={44} className="text-violet mx-auto" />
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Artist mode connected</h2>
                    <p className="text-mute text-sm mt-1">
                      Artists can launch and manage coins, plus buy, sell, follow, and view every market like an investor.
                    </p>
                  </div>
                  {audius && (
                    <div className="rounded-2xl border border-edge bg-panel2 p-4 text-left">
                      <div className="text-[10px] uppercase tracking-widest font-black text-mute">You&apos;re signed in as</div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-violet/25 bg-violet/15">
                          {audius.avatar ? (
                            <img src={audius.avatar} alt={audius.handle} className="h-full w-full object-cover" />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-lg font-black text-violet">
                              {(audius.name || audius.handle || "A").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-black text-ink break-words leading-tight">{audius.name || `@${audius.handle}`}</div>
                          <div className="mt-1 text-xs text-violet break-all">@{audius.handle}</div>
                          <div className="mt-2 text-[10px] uppercase tracking-widest font-bold text-mute">
                            Audius wallet: <span className="font-mono text-ink">{audius.wallets?.sol ? `${audius.wallets.sol.slice(0, 6)}…${audius.wallets.sol.slice(-4)}` : "Not exposed"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-[10px] uppercase tracking-widest font-bold text-mute">
                        Trading wallet: <span className="font-mono text-ink">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "External wallet optional"}</span>
                      </div>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <button className="btn-primary w-full" onClick={() => { setStep("DONE"); setTimeout(onClose, 400); }}>
                      Continue as artist
                    </button>
                    <button className="btn w-full" onClick={() => setStep("WALLET")}>
                      Connect external Solana wallet
                    </button>
                  </div>
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

function AudiusStep({ busy, err, onOAuth }: {
  busy: string | null; err: string | null;
  onOAuth: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-12 h-12 bg-violet/10 text-violet rounded-full flex items-center justify-center mx-auto mb-3">
          <ShieldCheck size={24} />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Connect Audius</h2>
        <p className="text-mute text-sm mt-1">Use Sign in with Audius to verify artist identity. Manual handle linking is disabled for launch access.</p>
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

      <p className="text-[11px] text-mute leading-relaxed">
        OAuth opens Audius in a popup. Your public profile and Audius-linked wallet are attached only after the Audius sign-in succeeds.
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
