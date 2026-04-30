"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession, useUI } from "@/lib/store";

export function RoleToggle() {
  const { address } = useSession();
  const { setUserMode } = useUI();
  const [me, setMe] = useState<any>(null);

  async function load() {
    if (!address) return setMe(null);
    const r = await fetch(`/api/me?wallet=${address}`).then((r) => r.json()).catch(() => ({}));
    setMe(r.user);
    if (r.user?.preferredMode) setUserMode(r.user.preferredMode);
  }
  useEffect(() => { load(); const i = setInterval(load, 6000); return () => clearInterval(i); }, [address]);

  if (!me || me.role !== "ARTIST") return null;

  async function set(mode: "ARTIST" | "INVESTOR") {
    setUserMode(mode);
    const r = await fetch("/api/me/mode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: address, mode }),
    });
    if (r.ok) load();
  }

  const mode = me.preferredMode as "ARTIST" | "INVESTOR";
  return (
    <div className="hidden md:flex items-center bg-white/[0.02] border border-white/[0.04] rounded-xl p-0.5 text-[10px] font-black uppercase tracking-widest">
      <button
        className={`relative px-3 py-1.5 rounded-lg transition-all duration-300 ${
          mode === "INVESTOR" ? "text-white" : "text-white/20 hover:text-white/40"
        }`}
        onClick={() => set("INVESTOR")}
      >
        {mode === "INVESTOR" && (
          <motion.div
            layoutId="role-pill"
            className="absolute inset-0 bg-neon/10 border border-neon/20 rounded-lg"
            style={{ zIndex: -1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <span className={mode === "INVESTOR" ? "text-neon" : ""}>Investor</span>
      </button>
      <button
        className={`relative px-3 py-1.5 rounded-lg transition-all duration-300 ${
          mode === "ARTIST" ? "text-white" : "text-white/20 hover:text-white/40"
        }`}
        onClick={() => set("ARTIST")}
      >
        {mode === "ARTIST" && (
          <motion.div
            layoutId="role-pill"
            className="absolute inset-0 bg-violet/10 border border-violet/20 rounded-lg"
            style={{ zIndex: -1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <span className={mode === "ARTIST" ? "text-violet" : ""}>Artist</span>
      </button>
    </div>
  );
}
