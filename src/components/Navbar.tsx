"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Star, Bell, Volume2, VolumeX, Search } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { WalletBalance } from "./WalletBalance";
import { AudiusLoginButton } from "./AudiusLoginButton";
import { RoleToggle } from "./RoleToggle";
import { LoginModal } from "./LoginModal";
import { useSession, useUI, usePrestige, useAlerts } from "@/lib/store";

const NAV = [
  { href: "/", label: "MARKET", icon: "◉" },
  { href: "/portfolio", label: "PORTFOLIO", icon: "◧" },
  { href: "/social", label: "INTEL", icon: "📡" },
  { href: "/artist", label: "STUDIO", reqArtistMode: true, icon: "♫" },
  { href: "/faq", label: "SUPPORT", icon: "?" },
];

const TIER_COLORS: Record<string, string> = {
  newcomer: "text-white/40",
  bronze: "text-bronze",
  silver: "text-silver",
  gold: "text-gold",
  platinum: "text-platinum",
  diamond: "text-cyan",
};

export function Navbar() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { address, audius } = useSession();
  const { loginModalOpen, openLoginModal, closeLoginModal, userMode, theme, setTheme, soundEnabled, toggleSound } = useUI();
  const { tier } = usePrestige();
  const { alerts } = useAlerts();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const unreadAlerts = alerts.filter(a => a.triggered && !a.triggered).length;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.04] transition-colors duration-500">
      {/* Glass background with premium blur */}
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-2xl" />
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 relative">
        <div className="flex items-center gap-3 md:gap-6 h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0" onClick={() => setMenuOpen(false)}>
            <div className="relative">
              <span className="w-2 h-2 rounded-full bg-neon block shadow-[0_0_8px_rgba(0,229,114,0.6)] animate-pulseDot" />
              <span className="absolute inset-0 w-2 h-2 rounded-full bg-neon animate-pulseRing" />
            </div>
            <span className="font-mono font-black tracking-tight text-white text-base">
              SONG<span className="text-neon">·</span>DAQ
            </span>
            {/* Prestige badge */}
            {mounted && address && tier !== "newcomer" && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`text-[8px] font-black uppercase tracking-widest ${TIER_COLORS[tier] || "text-white/40"} bg-white/5 px-1.5 py-0.5 rounded border border-white/10`}
              >
                {tier}
              </motion.span>
            )}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((n) => {
              if (n.reqArtistMode && userMode !== "ARTIST") return null;
              const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`relative px-4 py-2 rounded-xl text-[11px] font-bold tracking-widest transition-all duration-300 ${
                    active
                      ? "text-white"
                      : "text-white/35 hover:text-white/70"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 bg-white/[0.06] border border-white/[0.08] rounded-xl"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Search Trigger */}
          <div className="hidden md:flex flex-1 max-w-[280px] ml-4">
            <button 
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="w-full flex items-center justify-between px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/20 hover:text-white/40 hover:bg-white/[0.04] transition group"
            >
              <div className="flex items-center gap-2.5">
                <Search size={14} className="group-hover:text-neon transition-colors" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Search Assets...</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-[9px] font-mono">⌘K</kbd>
              </div>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {mounted && address ? (
              <>
                <div className="hidden md:block">
                  <RoleToggle />
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <AudiusLoginButton />
                  <WalletBalance />
                </div>

                {/* Sound toggle */}
                <button
                  onClick={toggleSound}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                  title={soundEnabled ? "Mute" : "Unmute"}
                >
                  {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>

                <WalletButton />
              </>
            ) : (
              <button 
                className="btn-primary px-5 py-2 text-[10px] font-black tracking-widest shadow-neon-glow" 
                onClick={openLoginModal}
              >
                <span className="relative z-10">CONNECT</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <button
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open menu"
            >
              <span className="block w-4 leading-none text-sm font-bold">{menuOpen ? "✕" : "≡"}</span>
            </button>
          </div>
        </div>
      </div>

      <LoginModal isOpen={loginModalOpen} onClose={closeLoginModal} />

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden overflow-hidden border-t border-white/[0.04] bg-bg/95 backdrop-blur-2xl relative"
          >
            <nav className="flex flex-col p-4 space-y-1">
              {NAV.map((n) => {
                if (n.reqArtistMode && userMode !== "ARTIST") return null;
                const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMenuOpen(false)}
                    className={`px-4 py-3 rounded-xl text-xs font-bold tracking-widest transition-all ${
                      active ? "bg-white/[0.06] text-white" : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                    }`}
                  >
                    <span className="mr-3 opacity-40">{n.icon}</span>
                    {n.label}
                  </Link>
                );
              })}
              <div className="border-t border-white/[0.04] mt-3 pt-3 flex flex-col gap-2">
                <AudiusLoginButton />
                <WalletBalance />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
