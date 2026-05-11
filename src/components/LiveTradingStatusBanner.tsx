"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileCheck2 } from "lucide-react";
import { usePaperTrading } from "@/lib/store";

type LaunchStatus = {
  walletTransactionsEnabled?: boolean;
  phantomReviewRequired?: boolean;
  phantomReviewSubmitted?: boolean;
  phantomReviewApproved?: boolean;
  network?: string;
};

export function LiveTradingStatusBanner({ compact = false }: { compact?: boolean }) {
  const paper = usePaperTrading();
  const [status, setStatus] = useState<LaunchStatus | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/launch/status", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (alive) setStatus(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!status || status.walletTransactionsEnabled !== false) return null;

  return (
    <div className={`rounded-2xl border border-amber/25 bg-amber/10 text-amber ${compact ? "p-3" : "p-4"} flex items-start gap-3`}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest font-black">Live trading paused until Phantom review clears</div>
        <p className="mt-1 text-xs leading-relaxed text-amber/85">
          SONG·DAQ is preventing live wallet signing on this domain while Phantom/Blowfish review is pending. Paper Mode is safe to use because it does not touch real money.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => paper.setEnabled(true)}
            className="rounded-xl border border-neon/25 bg-neon/15 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-neon"
          >
            Use Paper Mode
          </button>
          <a
            href="/admin/phantom"
            className="rounded-xl border border-edge bg-panel2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-ink inline-flex items-center gap-2"
          >
            <FileCheck2 size={12} /> Review status
          </a>
        </div>
      </div>
    </div>
  );
}

export function PaperFallbackGate() {
  const paper = usePaperTrading();
  useEffect(() => {
    let alive = true;
    fetch("/api/launch/status", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (!alive || !j) return;
        if (j.walletTransactionsEnabled === false && !paper.enabled) paper.setEnabled(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [paper]);
  return null;
}
