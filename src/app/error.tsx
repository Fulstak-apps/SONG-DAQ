"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/lib/store";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const address = useSession((s) => s.address);

  useEffect(() => {
    console.error("Caught by App Error Boundary:", error);
    fetch("/api/error-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        errorType: "react-boundary",
        message: error.message,
        stack: error.stack,
        page: window.location.pathname,
        walletAddress: address,
      }),
    }).catch(() => {});
  }, [address, error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-ink p-6">
      <div className="max-w-md w-full p-8 rounded-3xl border border-edge bg-panel backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden grain">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-16 h-16 rounded-full bg-red/10 flex items-center justify-center mx-auto mb-2 border border-red/20 shadow-[0_0_20px_rgba(255,51,102,0.2)]">
          <span className="text-red text-2xl">⚠</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight drop-shadow-md">Something went wrong</h2>
        <div className="text-[11px] font-mono text-mute p-4 bg-panel2 rounded-xl border border-edge overflow-auto max-h-[150px] text-left">
          {error.message || "An unexpected error occurred in the React application."}
        </div>
        <div className="flex gap-3 justify-center pt-2 relative z-10">
          <button
            onClick={() => reset()}
            className="px-6 py-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-all bg-panel2 text-ink hover:bg-white/10 border border-edge"
          >
            Try Again
          </button>
          <Link
            href="/market"
            className="px-6 py-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-all bg-neon/10 text-neon hover:bg-neon/20 border border-neon/20 shadow-[0_0_15px_rgba(0,229,114,0.15)]"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
