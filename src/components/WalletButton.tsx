"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/lib/store";
import { WALLETS, connectWallet, disconnectWallet, type WalletId } from "@/lib/wallet";
import { Loader2, Wallet, LogOut, ExternalLink } from "lucide-react";

function shortAddr(a: string) {
  if (!a) return "";
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function WalletButton() {
  const { address, kind, provider, setSession, clear } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<WalletId | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function onConnect(id: WalletId) {
    setBusy(id);
    setErr(null);
    try {
      const r = await connectWallet(id);
      setSession({ address: r.address, kind: r.kind, provider: r.provider });
      setOpen(false);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onDisconnect() {
    await disconnectWallet(provider as WalletId | null);
    clear();
  }

  if (!mounted) {
    return <button className="btn text-[10px] font-bold uppercase tracking-widest">Connect</button>;
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.04] bg-white/[0.02] backdrop-blur-xl">
          <span className={`w-1.5 h-1.5 rounded-full ${kind === "solana" ? "bg-violet shadow-[0_0_4px_rgba(155,81,224,0.5)]" : "bg-neon shadow-[0_0_4px_rgba(0,229,114,0.5)]"}`} />
          <span className="text-[10px] text-white/30 uppercase tracking-widest font-black">{kind === "solana" ? "SOL" : "EVM"}</span>
          <span className="text-[10px] font-mono text-white/50 font-bold">{shortAddr(address)}</span>
        </div>
        <button
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/20 hover:text-red hover:bg-red/5 hover:border-red/20 transition"
          onClick={onDisconnect}
          title="Disconnect wallet"
        >
          <LogOut size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setOpen(false);
      }
    }}>
      <button className="btn-primary px-5 py-2 text-[10px] font-black tracking-widest" onClick={() => setOpen((v) => !v)}>
        <Wallet size={12} /> Connect
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="absolute right-0 top-12 w-72 rounded-2xl border border-white/[0.06] bg-[var(--glass-bg-elevated)] backdrop-blur-3xl p-3 z-40 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
          >
            <div className="px-2 py-1.5 label">Solana</div>
            {WALLETS.filter((w) => w.kind === "solana").map((w) => (
              <WalletRow
                key={w.id}
                w={w}
                busy={busy === w.id}
                onConnect={() => onConnect(w.id)}
              />
            ))}
            {WALLETS.some(w => w.kind === "evm") && (
              <>
                <div className="px-2 py-1.5 label mt-2">EVM</div>
                {WALLETS.filter((w) => w.kind === "evm").map((w) => (
                  <WalletRow
                    key={w.id}
                    w={w}
                    busy={busy === w.id}
                    onConnect={() => onConnect(w.id)}
                  />
                ))}
              </>
            )}
            {err && <div className="text-red text-[10px] px-2 py-2 mt-1 bg-red/5 border border-red/10 rounded-lg font-bold">{err}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WalletRow({
  w,
  busy,
  onConnect,
}: {
  w: { id: WalletId; label: string; installed: () => boolean; installUrl: string };
  busy: boolean;
  onConnect: () => void;
}) {
  const installed = w.installed();
  return (
    <button
      onClick={installed ? onConnect : () => window.open(w.installUrl, "_blank")}
      className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/[0.03] transition group"
      disabled={busy}
    >
      <span className="text-sm font-bold text-white/50 group-hover:text-white/80 transition">{w.label}</span>
      <span className="text-[9px] text-white/15 uppercase tracking-widest font-bold flex items-center gap-1">
        {busy ? <Loader2 size={12} className="animate-spin" /> : installed ? "Connect →" : <><ExternalLink size={10} /> Install</>}
      </span>
    </button>
  );
}
