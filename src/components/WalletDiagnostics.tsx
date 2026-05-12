"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, RefreshCw, Wallet } from "lucide-react";
import { WALLETS, walletDiagnosticsSnapshot } from "@/lib/wallet";
import { useNativeBalance } from "@/components/WalletBalance";
import { useSession } from "@/lib/store";
import { fmtSol } from "@/lib/pricing";
import { toast } from "@/lib/toast";
import { useWalletDiscoveryVersion } from "@/lib/useWalletDiscovery";

export function WalletDiagnostics({ compact = false }: { compact?: boolean }) {
  const { address, kind, provider, audius } = useSession();
  const hasExternal = !!address && provider !== "audius" && provider !== "paper";
  const native = useNativeBalance(hasExternal ? address : null, hasExternal ? kind : null);
  const [health, setHealth] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const walletDiscoveryVersion = useWalletDiscoveryVersion();

  const installed = useMemo(
    () => WALLETS.map((w) => ({ id: w.id, label: w.label, installed: w.installed() })),
    [walletDiscoveryVersion],
  );

  async function loadHealth() {
    setBusy(true);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      setHealth(await r.json().catch(() => null));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadHealth(); }, []);

  async function reportIssue() {
    setReporting(true);
    try {
      const payload = {
        errorType: "wallet_diagnostics",
        walletAddress: address || audius?.wallets?.sol || null,
        page: typeof window !== "undefined" ? window.location.href : "",
        message: [
          `provider=${provider || "none"}`,
          `external=${hasExternal ? "yes" : "no"}`,
          `network=${health?.network || "unknown"}`,
          `phantomApproved=${health?.walletTrust?.phantomReviewApproved ? "yes" : "no"}`,
          `db=${health?.database?.connected ? "connected" : "not_connected"}`,
        ].join(" | "),
        stack: JSON.stringify({ installed, health, browserWallets: walletDiagnosticsSnapshot() }, null, 2),
      };
      await fetch("/api/error-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Wallet issue reported", "Admin can review this in the error log.");
    } catch (e: any) {
      toast.error("Report failed", e.message ?? String(e));
    } finally {
      setReporting(false);
    }
  }

  return (
    <section className={`panel ${compact ? "p-4" : "p-5"} space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest font-black text-neon flex items-center gap-2">
            <Wallet size={14} /> Wallet diagnostics
          </div>
          <p className="mt-1 text-xs leading-relaxed text-mute">
            Checks installed wallets, connected address, network, SOL balance, Audius wallet, RPC, and database status.
          </p>
        </div>
        <button onClick={loadHealth} className="btn h-9 px-3 text-[11px]" disabled={busy}>
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Diag label="Connected" value={hasExternal ? "External wallet" : address ? "Audius wallet only" : "Not connected"} ok={hasExternal} />
        <Diag label="Address" value={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "None"} ok={!!address} />
        <Diag label="SOL balance" value={hasExternal ? `${fmtSol(native.balance ?? 0, 4)} SOL` : "Connect external"} ok={hasExternal && !native.error} />
        <Diag label="Network" value={health?.network || "Checking"} ok={health?.network === "mainnet-beta" || health?.network === "devnet"} />
        <Diag label="RPC" value={health?.rpcConfigured ? "Configured" : "Missing"} ok={!!health?.rpcConfigured} />
        <Diag label="Database" value={health?.database?.connected ? "Connected" : "Slow/unreachable"} ok={!!health?.database?.connected} />
        <Diag label="Audius wallet" value={audius?.wallets?.sol ? `${audius.wallets.sol.slice(0, 6)}…${audius.wallets.sol.slice(-4)}` : "Not exposed"} ok={!!audius?.wallets?.sol} />
      </div>

      <div className="flex flex-wrap gap-2">
        {installed.map((w) => (
          <span key={w.id} className={`chip ${w.installed ? "text-neon border-neon/20 bg-neon/10" : "text-mute border-edge bg-panel2"}`}>
            {w.label}: {w.installed ? "Installed" : "Not found"}
          </span>
        ))}
      </div>

      <button onClick={reportIssue} disabled={reporting} className="btn-danger h-10 px-4 text-[11px] uppercase tracking-widest font-black">
        <Bug size={13} /> {reporting ? "Reporting…" : "Report wallet issue"}
      </button>
    </section>
  );
}

function Diag({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3">
      <div className="text-[11px] uppercase tracking-widest font-black text-mute">{label}</div>
      <div className={`mt-1 text-sm font-black break-words ${ok ? "text-ink" : "text-amber"}`}>{value}</div>
    </div>
  );
}
