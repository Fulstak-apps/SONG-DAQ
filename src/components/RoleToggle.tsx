"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePaperTrading, useSession, useUI } from "@/lib/store";
import { readJson } from "@/lib/safeJson";

export function RoleToggle() {
  const { address, audius } = useSession();
  const { userMode, setUserMode } = useUI();
  const { enabled: paperMode } = usePaperTrading();
  const [me, setMe] = useState<any>(null);

  async function load() {
    if (audius && userMode !== "ARTIST") {
      setUserMode("ARTIST");
    }
    if (!address) {
      setMe(null);
      return;
    }
    const r = await fetch(`/api/me?wallet=${address}`).then((r) => readJson<any>(r)).catch(() => null);
    setMe(r?.user ?? null);
    if (!audius && r?.user?.preferredMode) setUserMode(r.user.preferredMode);
  }
  useEffect(() => { load(); const i = setInterval(load, 6000); return () => clearInterval(i); }, [address, audius?.userId, userMode]);

  const artistCapable = !!audius || me?.role === "ARTIST" || me?.role === "ADMIN";
  if (!paperMode && !audius && (!me || !artistCapable)) return null;

  async function set(mode: "ARTIST" | "INVESTOR") {
    if (audius && mode !== "ARTIST") {
      setUserMode("ARTIST");
      return;
    }
    setUserMode(mode);
    if (paperMode || audius) return;
    const r = await fetch("/api/me/mode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: address, mode }),
    });
    if (r.ok) load();
  }

  const mode = (audius ? "ARTIST" : ((paperMode ? userMode : me?.preferredMode) || "INVESTOR")) as "ARTIST" | "INVESTOR";
  const investorActive = mode === "INVESTOR";
  const artistActive = mode === "ARTIST";

  return (
    <div className="hidden md:flex items-center bg-white/[0.055] border border-edge rounded-xl p-0.5 text-[11px] font-black uppercase tracking-widest" title={paperMode ? "Paper trading mode lets you preview either role locally." : "Artist accounts include investor access. Investor-only accounts cannot switch into Artist mode."}>
      <button
        className={`relative px-3 py-1.5 rounded-lg transition-all duration-300 ${
          investorActive ? "text-ink" : "text-mute hover:text-ink"
        }`}
        onClick={() => set("INVESTOR")}
      >
        {investorActive && (
          <motion.div
            layoutId="role-pill"
            className="absolute inset-0 bg-neon/15 border border-neon/35 rounded-lg shadow-[0_0_16px_rgba(0,229,114,0.18)]"
            style={{ zIndex: -1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <span className={investorActive ? "text-neon" : ""}>Investor</span>
      </button>
      <button
        className={`relative px-3 py-1.5 rounded-lg transition-all duration-300 ${
          artistActive ? "text-ink" : "text-mute hover:text-ink"
        }`}
        onClick={() => set("ARTIST")}
      >
        {artistActive && (
          <motion.div
            layoutId="role-pill"
            className="absolute inset-0 bg-violet/15 border border-violet/35 rounded-lg shadow-[0_0_16px_rgba(155,81,224,0.18)]"
            style={{ zIndex: -1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <span className={artistActive ? "text-violet" : ""}>Artist</span>
      </button>
    </div>
  );
}
