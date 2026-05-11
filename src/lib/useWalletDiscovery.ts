"use client";

import { useEffect, useState } from "react";

export function useWalletDiscoveryVersion() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((current) => current + 1);
    const events = ["phantom#initialized", "solana#initialized", "wallet-standard:app-ready"];
    events.forEach((event) => window.addEventListener(event, bump as EventListener));

    bump();
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      bump();
      if (Date.now() - startedAt > 8_000) window.clearInterval(interval);
    }, 500);

    return () => {
      window.clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, bump as EventListener));
    };
  }, []);

  return version;
}
