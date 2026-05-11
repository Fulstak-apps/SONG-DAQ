"use client";

import { usePaperTrading } from "@/lib/store";

export function PaperModeFrame() {
  const enabled = usePaperTrading((s) => s.enabled);
  if (!enabled) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[9998] border-2 border-neon/80 shadow-[inset_0_0_24px_rgba(0,229,114,0.18),0_0_28px_rgba(0,229,114,0.35)]" />
      <div className="pointer-events-none fixed bottom-3 left-1/2 z-[9999] -translate-x-1/2 rounded-full border border-neon/35 bg-black/85 px-4 py-2 text-center shadow-[0_0_24px_rgba(0,229,114,0.28)] backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-neon">Paper Mode</div>
        <div className="mt-0.5 text-[10px] font-bold text-white/70">Simulated funds. No real money.</div>
      </div>
    </>
  );
}
