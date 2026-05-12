"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, useUI } from "@/lib/store";
import { WALLETS, connectWallet, disconnectWallet, reportWalletError, walletDiagnosticsSnapshot, type WalletId } from "@/lib/wallet";
import { safeJson } from "@/lib/safeJson";
import { Loader2, Wallet, LogOut, ExternalLink } from "lucide-react";
import { toast } from "@/lib/toast";
import { useWalletDiscoveryVersion } from "@/lib/useWalletDiscovery";

function shortAddr(a: string) {
  if (!a) return "";
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

function postAudiusLinkInBackground(body: unknown) {
  const ctrl = new AbortController();
  const timeout = window.setTimeout(() => ctrl.abort(), 2_000);
  fetch("/api/audius/link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  })
    .then((link) => safeJson(link).then((j) => ({ ok: link.ok, data: j })))
    .then(({ ok, data }) => {
      if (!ok || (data as any)?.linkPending) {
        toast.info("Wallet connected", (data as any)?.error || "Artist profile will sync in the background.");
      }
    })
    .catch(() => {
      toast.info("Wallet connected", "Profile sync is still catching up, but your wallet is ready.");
    })
    .finally(() => window.clearTimeout(timeout));
}

export function WalletButton({ compact = false, connectOnly = false }: { compact?: boolean; connectOnly?: boolean }) {
  const { address, kind, provider, audius, setSession, clear } = useSession();
  const { userMode } = useUI();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<WalletId | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useWalletDiscoveryVersion();
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
  const hasExternalWallet = !!address && provider !== "audius";

  useEffect(() => setMounted(true), []);

  async function onConnect(id: WalletId) {
    setBusy(id);
    setErr(null);
    try {
      const r = await connectWallet(id);
      setSession({ address: r.address, kind: r.kind, provider: r.provider });
      if (audius) {
        postAudiusLinkInBackground({
          wallet: r.address,
          walletType: r.kind,
          profile: audius,
          role: userMode === "ARTIST" ? "ARTIST" : undefined,
        });
      }
      setOpen(false);
    } catch (e: any) {
      reportWalletError("wallet_connect_failed", e, id, address).catch(() => {});
      setErr(e.message ?? String(e));
      console.error("song-daq wallet connect failed", e);
      console.info("song-daq wallet diagnostics", walletDiagnosticsSnapshot());
    } finally {
      setBusy(null);
    }
  }

  async function onDisconnect() {
    await disconnectWallet(provider as WalletId | null);
    clear();
  }

  if (!mounted) {
    return <button className="btn text-[10px] font-bold uppercase tracking-widest">{compact ? "Wallet" : "Connect"}</button>;
  }

  if (hasExternalWallet) {
    return (
      <div className="flex items-center gap-2">
        {compact ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-edge bg-white/[0.055] backdrop-blur-xl max-w-[122px]">
            <span className="w-1.5 h-1.5 rounded-full bg-violet shadow-[0_0_4px_rgba(155,81,224,0.5)]" />
            <span className="min-w-0 truncate text-[10px] font-mono text-ink font-bold">{shortAddr(address)}</span>
            <span className="rounded-md border border-neon/20 bg-neon/10 px-1 py-0.5 text-[7px] uppercase tracking-widest font-black text-neon shrink-0">{network}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-edge bg-white/[0.055] backdrop-blur-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-violet shadow-[0_0_4px_rgba(155,81,224,0.5)]" />
            <span className="text-[10px] text-mute uppercase tracking-widest font-black">Trading Wallet</span>
            <span className="text-[10px] font-mono text-ink font-bold">{shortAddr(address)}</span>
            <span className="rounded-md border border-neon/20 bg-neon/10 px-1.5 py-0.5 text-[8px] uppercase tracking-widest font-black text-neon">{network}</span>
          </div>
        )}
        <button
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.055] border border-edge text-mute hover:text-red hover:bg-red/10 hover:border-red/25 transition"
          onClick={onDisconnect}
          title="Disconnect all wallets"
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
      <button className={`btn-primary text-[10px] font-black tracking-widest ${compact ? "px-3 py-2" : "px-5 py-2"}`} onClick={() => setOpen((v) => !v)}>
        <Wallet size={12} /> {compact ? "Wallet" : "Connect"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="absolute right-0 top-12 w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-2xl border border-edge bg-panel backdrop-blur-3xl p-3 z-40 shadow-[0_20px_40px_rgba(0,0,0,0.6)] text-ink"
          >
            <div className="px-2 py-1.5 label">Solana wallets · {network}</div>
            {WALLETS.map((w) => (
              <WalletRow
                key={w.id}
                w={w}
                busy={busy === w.id}
                onConnect={() => onConnect(w.id)}
              />
            ))}
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
      className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/[0.08] transition group"
      disabled={busy}
    >
      <span className="text-sm font-bold text-ink transition">{w.label}</span>
      <span className="text-[9px] text-mute uppercase tracking-widest font-bold flex items-center gap-1">
        {busy ? <Loader2 size={12} className="animate-spin" /> : installed ? "Connect →" : <><ExternalLink size={10} /> Install</>}
      </span>
    </button>
  );
}
