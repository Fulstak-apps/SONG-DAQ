"use client";

import { usePaperTrading } from "@/lib/store";

export function PaperModeFrame() {
  const enabled = usePaperTrading((s) => s.enabled);
  if (!enabled) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[9998] border-2 border-neon/80 shadow-[inset_0_0_24px_rgba(0,229,114,0.18),0_0_28px_rgba(0,229,114,0.35)]" />
    </>
  );
}
