"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sun, Moon, Volume2, VolumeX, Search } from "lucide-react";
import { WalletBalance } from "./WalletBalance";
import { CurrencySelector } from "./CurrencySelector";
import { AudiusLoginButton } from "./AudiusLoginButton";
import { RoleToggle } from "./RoleToggle";
import { LoginModal } from "./LoginModal";
import { WalletButton } from "./WalletButton";
import { PAPER_WALLET_ADDRESS, PAPER_WALLET_PROVIDER, isPaperWalletAddress, usePaperTrading, useSession, useUI, usePrestige, useAlerts } from "@/lib/store";
import { safeJson } from "@/lib/safeJson";
import { getCurrentWalletAddress, subscribeWalletChanges, type WalletId } from "@/lib/wallet";

type NavItem = { href: string; label: string; icon: string; reqArtistMode?: boolean };

const NAV: NavItem[] = [
  { href: "/market", label: "MARKET", icon: "◉" },
  { href: "/signals", label: "SIGNALS", icon: "◇" },
  { href: "/portfolio", label: "PORTFOLIO", icon: "◧" },
  { href: "/artist", label: "LAUNCH COIN", reqArtistMode: true, icon: "♫" },
  { href: "/social", label: "INTEL", icon: "📡" },
  { href: "/faq", label: "SUPPORT", icon: "?" },
];

const TIER_COLORS: Record<string, string> = {
  newcomer: "text-mute",
  bronze: "text-bronze",
  silver: "text-silver",
  gold: "text-gold",
  platinum: "text-platinum",
  diamond: "text-cyan",
};

export function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const { address, provider, audius, setSession } = useSession();
  const { loginModalOpen, openLoginModal, closeLoginModal, userMode, setUserMode, theme, setTheme, soundEnabled, toggleSound } = useUI();
  const { enabled: paperMode, setEnabled: setPaperMode } = usePaperTrading();
  const { tier } = usePrestige();
  const { alerts } = useAlerts();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [adminSession, setAdminSession] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!address || isPaperWalletAddress(address)) {
      setRole(null);
      return;
    }
    let alive = true;
    fetch(`/api/me?wallet=${encodeURIComponent(address)}`, { cache: "no-store" })
      .then((r) => safeJson(r))
      .then((j) => {
        if (alive) setRole((j as any)?.user?.role ?? null);
      })
      .catch(() => {
        if (alive) setRole(null);
      });
    return () => { alive = false; };
  }, [address]);
  useEffect(() => {
    if (!mounted) return;
    if (paperMode && !address) {
      setSession({ address: PAPER_WALLET_ADDRESS, kind: "solana", provider: PAPER_WALLET_PROVIDER });
      return;
    }
    if (!paperMode && isPaperWalletAddress(address)) {
      setSession({ address: null, kind: null, provider: null });
    }
  }, [address, mounted, paperMode, setSession]);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => safeJson(r))
      .then((j) => { if (alive) setAdminSession(!!(j as any).authenticated); })
      .catch(() => { if (alive) setAdminSession(false); });
    const onFocus = () => {
      fetch("/api/admin/session", { cache: "no-store" })
        .then((r) => safeJson(r))
        .then((j) => setAdminSession(!!(j as any).authenticated))
        .catch(() => setAdminSession(false));
    };
    window.addEventListener("focus", onFocus);
    return () => { alive = false; window.removeEventListener("focus", onFocus); };
  }, []);
  useEffect(() => {
    if (!provider || provider === "audius" || provider === PAPER_WALLET_PROVIDER) return;
    const walletId = provider as WalletId;
    const syncAddress = (nextAddress: string | null) => {
      if (nextAddress) {
        setSession({ address: nextAddress, kind: "solana", provider: walletId });
        return;
      }
      setSession({ address: null, kind: null, provider: null });
    };

    const currentAddress = getCurrentWalletAddress(walletId);
    if (currentAddress && currentAddress !== address) syncAddress(currentAddress);
    return subscribeWalletChanges(walletId, syncAddress);
  }, [address, provider, setSession]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const unreadAlerts = alerts.filter(a => a.triggered && !a.triggered).length;
  useEffect(() => {
    if (audius) setUserMode("ARTIST");
  }, [audius, setUserMode]);
  useEffect(() => {
    if (typeof window === "undefined" || !audius) return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("artistWallet") !== "1") return;
    setUserMode("ARTIST");
    openLoginModal();
    router.replace(path || "/market", { scroll: false });
  }, [audius, openLoginModal, path, router, setUserMode]);

  const isDarnellAudius = audius?.name?.trim().toLowerCase() === "darnell williams";
  const navItems = role === "ADMIN" || adminSession || isDarnellAudius ? [...NAV, { href: "/admin", label: "ADMIN", icon: "⚙" }] : NAV;
  const isPaperWallet = isPaperWalletAddress(address);
  const hasSeparateExternalWallet = !!(address && provider !== "audius" && provider !== PAPER_WALLET_PROVIDER && !isPaperWallet);
  const togglePaperMode = () => {
    const next = !paperMode;
    setPaperMode(next);
    if (next && !address) {
      setSession({ address: PAPER_WALLET_ADDRESS, kind: "solana", provider: PAPER_WALLET_PROVIDER });
    }
    if (!next && isPaperWallet) {
      setSession({ address: null, kind: null, provider: null });
    }
  };
  const navigate = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    router.push(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-edge transition-colors duration-500">
      {/* Glass background with premium blur */}
      <div className="absolute inset-0 bg-bg/92 backdrop-blur-2xl" />
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      
      <div className="mx-auto w-full max-w-[1680px] px-2 sm:px-3 lg:px-4 2xl:px-6 relative">
        <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 lg:gap-2 min-h-14 py-1 xl:min-h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group shrink-0 mr-0.5 sm:mr-1">
            <div className="relative">
              <span className="w-2 h-2 rounded-full bg-neon block shadow-[0_0_8px_rgba(0,229,114,0.6)] animate-pulseDot" />
              <span className="absolute inset-0 w-2 h-2 rounded-full bg-neon animate-pulseRing" />
            </div>
            <span className="font-mono font-black tracking-tight text-ink text-sm sm:text-base xl:text-lg">
              SONG<span className="text-neon">·</span>DAQ
            </span>
            {/* Prestige badge */}
            {mounted && address && tier !== "newcomer" && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`hidden 2xl:inline-flex text-[11px] font-black uppercase tracking-widest ${TIER_COLORS[tier] || "text-mute"} bg-white/8 px-1.5 py-0.5 rounded border border-edge`}
              >
                {tier}
              </motion.span>
            )}
          </Link>

          <nav className="hidden lg:flex flex-1 min-w-0 items-center gap-0.5 overflow-x-auto no-scrollbar">
            {navItems.map((n) => {
              if (n.reqArtistMode && userMode !== "ARTIST") return null;
              const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  prefetch={false}
                  onClick={navigate(n.href)}
                  aria-current={active ? "page" : undefined}
                  className={`relative shrink-0 px-2 py-2.5 rounded-xl text-[10px] font-black tracking-[0.14em] transition-all duration-300 2xl:px-3 2xl:text-xs 2xl:tracking-widest ${
                    active
                      ? "text-neon shadow-[0_0_18px_rgba(0,229,114,0.16)]"
                      : "text-mute hover:text-ink hover:bg-white/[0.045]"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-xl border border-neon/35 bg-neon/12 shadow-[inset_0_0_14px_rgba(0,229,114,0.08)]"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  {active && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_8px_rgba(0,229,114,0.8)]" />}
                  {n.label}
                </Link>
              );
            })}
            {paperMode && (
              <span className="ml-1 inline-flex shrink-0 items-center rounded-full border border-neon/25 bg-neon/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-neon">
                Demo Paper Trading
              </span>
            )}
          </nav>

          <div className="ml-auto hidden xl:flex max-w-[46vw] min-w-0 items-center justify-end gap-1 overflow-hidden 2xl:max-w-[54vw] 2xl:gap-1.5">
              {audius ? <div className="shrink-0"><AudiusLoginButton compact /></div> : null}
              {(hasSeparateExternalWallet || audius) ? <WalletBalance compact /> : paperMode ? <PaperWalletPill /> : null}
              <CurrencySelector compact />
              {(address || paperMode) ? <div className="hidden 2xl:block shrink-0"><RoleToggle /></div> : null}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {mounted && audius && !hasSeparateExternalWallet ? (
              <div className="shrink-0">
                <WalletButton compact connectOnly />
              </div>
            ) : null}

            {mounted && (address || audius || paperMode) ? (
              <button
                onClick={toggleSound}
                className="w-9 h-9 xl:h-10 xl:w-10 flex items-center justify-center rounded-xl bg-white/[0.055] border border-edge text-mute hover:text-ink hover:bg-white/[0.09] transition-all"
                title={soundEnabled ? "Mute" : "Unmute"}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            ) : (
              <button 
                className="btn-primary min-h-10 px-3 py-2 text-[11px] font-black tracking-widest shadow-neon-glow sm:px-5 sm:text-xs"
                onClick={openLoginModal}
              >
                <span className="relative z-10">CONNECT</span>
              </button>
            )}

            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="hidden 2xl:flex w-9 h-9 xl:h-10 xl:w-10 items-center justify-center rounded-xl bg-white/[0.055] border border-edge text-mute hover:text-ink hover:bg-white/[0.09] transition shrink-0"
              title="Search assets"
            >
              <Search size={13} />
            </button>

            <button
              onClick={togglePaperMode}
              className={`h-9 xl:h-10 rounded-xl border px-2.5 xl:px-3 text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${
                paperMode
                  ? "border-neon/40 bg-neon text-[#020403] shadow-[0_0_18px_rgba(0,229,114,0.22)]"
                  : "border-neon/20 bg-neon/10 text-neon hover:bg-neon/15"
              }`}
              title={paperMode ? "Paper Trade / Demo mode is on. No money moves." : "Turn on Paper Trade / Demo mode"}
            >
              Paper
            </button>

            <button
              onClick={toggleTheme}
              className="w-9 h-9 xl:h-10 xl:w-10 flex items-center justify-center rounded-xl bg-white/[0.055] border border-edge text-mute hover:text-ink hover:bg-white/[0.09] transition-all"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
        <nav className="md:hidden grid grid-cols-2 min-[390px]:grid-cols-3 gap-1 border-t border-edge/70 px-1 pb-2 pt-2">
          {navItems.map((n) => {
            if (n.reqArtistMode && userMode !== "ARTIST") return null;
            const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                prefetch={false}
                onClick={navigate(n.href)}
                aria-current={active ? "page" : undefined}
                className={`min-w-0 truncate rounded-xl border px-2.5 py-3 text-center text-[11px] font-black uppercase tracking-widest transition min-[390px]:text-[11px] ${
                  active
                    ? "border-neon/45 bg-neon/15 text-neon shadow-[0_0_16px_rgba(0,229,114,0.16)]"
                    : "border-edge bg-white/[0.045] text-mute hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          {paperMode && (
            <span className="col-span-2 min-[390px]:col-span-3 rounded-xl border border-neon/25 bg-neon/10 px-3 py-2 text-center text-[11px] font-black uppercase tracking-widest text-neon">
              Paper wallet active · simulated funds
            </span>
          )}
          <span className="col-span-2 min-[390px]:col-span-3 flex justify-center">
            <CurrencySelector compact />
          </span>
        </nav>
      </div>

      <LoginModal isOpen={loginModalOpen} onClose={closeLoginModal} />
    </header>
  );
}

function PaperWalletPill() {
  return (
    <div className="hidden items-center gap-2 rounded-xl border border-neon/25 bg-neon/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-neon lg:flex">
      <span className="h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_8px_rgba(0,229,114,0.8)]" />
      Paper Wallet
      <span className="font-mono text-[11px] text-neon/75">100 SOL · 2.5K AUDIO</span>
    </div>
  );
}
