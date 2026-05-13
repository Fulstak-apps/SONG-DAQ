"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  CircleHelp,
  Moon,
  Music2,
  Radio,
  Search,
  ShieldCheck,
  Sun,
  Volume2,
  VolumeX,
  WalletCards,
  X,
} from "lucide-react";
import { WalletBalance, useAudiusAudioBalance, useNativeBalance } from "./WalletBalance";
import { CurrencySelector } from "./CurrencySelector";
import { AudiusLoginButton } from "./AudiusLoginButton";
import { RoleToggle } from "./RoleToggle";
import { LoginModal } from "./LoginModal";
import { WalletButton } from "./WalletButton";
import { PAPER_WALLET_ADDRESS, PAPER_WALLET_PROVIDER, isPaperWalletAddress, usePaperTrading, useSession, useUI, usePrestige, useAlerts, type AudiusProfile } from "@/lib/store";
import { safeJson } from "@/lib/safeJson";
import { disconnectWallet, getCurrentWalletAddress, isKnownWalletId, subscribeWalletChanges, type WalletId } from "@/lib/wallet";
import { useUsdToDisplayRate } from "@/lib/fiat";

type NavItem = { href: string; label: string; icon: string; reqArtistMode?: boolean };

const NAV: NavItem[] = [
  { href: "/market", label: "MARKET", icon: "◉" },
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
    if (audius && userMode !== "ARTIST") setUserMode("ARTIST");
  }, [audius, setUserMode, userMode]);
  useEffect(() => {
    if (typeof window === "undefined" || !audius) return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("artistWallet") !== "1") return;
    setUserMode("ARTIST");
    openLoginModal();
    router.replace(path || "/market", { scroll: false });
  }, [audius, openLoginModal, path, router, setUserMode]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const requestedWallet = searchParams.get("walletConnect");
    if (!isKnownWalletId(requestedWallet)) return;
    const requestedRole = searchParams.get("walletRole");
    if (requestedRole === "ARTIST") setUserMode("ARTIST");
    openLoginModal();
  }, [openLoginModal, setUserMode]);

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
    <>
    <header className="mobile-header-safe sticky top-0 z-40 border-b border-edge transition-colors duration-500">
      {/* Glass background with premium blur */}
      <div className="absolute inset-0 bg-bg shadow-[0_14px_34px_rgba(0,0,0,0.34)] backdrop-blur-2xl md:bg-bg/92 md:shadow-none" />
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      
      <div className="mx-auto w-full max-w-[1680px] px-2 sm:px-3 lg:px-4 2xl:px-6 relative">
        <div className="flex min-h-[52px] min-w-0 items-center gap-1 py-1 sm:gap-1.5 lg:gap-2 xl:min-h-16">
          {/* Logo */}
          <Link href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2 group shrink-0 mr-0.5 sm:mr-1">
            <div className="relative">
              <span className="block h-2.5 w-2.5 rounded-full bg-neon shadow-[0_0_8px_rgba(0,229,114,0.6)] animate-pulseDot sm:h-2 sm:w-2" />
              <span className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-neon animate-pulseRing sm:h-2 sm:w-2" />
            </div>
            <span className="whitespace-nowrap font-mono text-sm font-black tracking-tight text-ink min-[390px]:text-[15px] xl:text-lg">
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
              if (n.reqArtistMode && userMode !== "ARTIST" && !paperMode) return null;
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

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            {mounted && audius && !hasSeparateExternalWallet ? (
              <div className="hidden shrink-0 sm:block">
                <WalletButton compact connectOnly />
              </div>
            ) : null}

            {mounted && (address || audius || paperMode) ? (
              <button
                onClick={toggleSound}
                className="hidden h-9 w-9 items-center justify-center rounded-xl border border-edge bg-white/[0.055] text-mute transition-all hover:bg-white/[0.09] hover:text-ink sm:flex xl:h-10 xl:w-10"
                title={soundEnabled ? "Mute" : "Unmute"}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            ) : (
              <button 
                className="btn-primary h-9 min-h-0 px-2.5 py-0 text-[10px] font-black tracking-widest shadow-neon-glow min-[390px]:px-3.5 sm:h-10 sm:px-5 sm:text-xs"
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
              className={`h-9 shrink-0 rounded-xl border px-2 text-[10px] font-black uppercase tracking-widest transition-all min-[390px]:px-2.5 sm:h-10 sm:px-3 sm:text-[11px] xl:px-3 ${
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-edge bg-white/[0.055] text-mute transition-all hover:bg-white/[0.09] hover:text-ink sm:h-10 sm:w-10"
              title="Toggle theme"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
        <MobileWalletSummary
          mounted={mounted}
          address={address}
          provider={provider}
          audius={audius}
          paperMode={paperMode}
          isPaperWallet={isPaperWallet}
          hasExternalWallet={hasSeparateExternalWallet}
        />
      </div>

      <LoginModal isOpen={loginModalOpen} onClose={closeLoginModal} />
    </header>
    <MobileBottomNav navItems={navItems} userMode={userMode} paperMode={paperMode} path={path} navigate={navigate} setUserMode={setUserMode} />
    </>
  );
}

function mobileNavLabel(label: string) {
  if (label === "LAUNCH COIN") return "Launch";
  if (label === "PORTFOLIO") return "Portfolio";
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function MobileNavIcon({ item }: { item: NavItem }) {
  const baseClass = "h-[21px] w-[21px]";
  if (item.href === "/market") return <BarChart3 className={baseClass} strokeWidth={2.35} />;
  if (item.href === "/portfolio") return <WalletCards className={baseClass} strokeWidth={2.35} />;
  if (item.href === "/artist") return <Music2 className={baseClass} strokeWidth={2.35} />;
  if (item.href === "/social") return <Radio className={baseClass} strokeWidth={2.35} />;
  if (item.href === "/admin") return <ShieldCheck className={baseClass} strokeWidth={2.35} />;
  return <CircleHelp className={baseClass} strokeWidth={2.35} />;
}

function MobileBottomNav({
  navItems,
  userMode,
  paperMode,
  path,
  navigate,
  setUserMode,
}: {
  navItems: NavItem[];
  userMode: string;
  paperMode: boolean;
  path: string;
  navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void;
  setUserMode: (mode: "ARTIST" | "INVESTOR") => void;
}) {
  const visibleItems = navItems.filter((item) => !item.reqArtistMode || userMode === "ARTIST" || paperMode);
  if (!visibleItems.length) return null;

  return (
    <nav className="mobile-bottom-nav-safe fixed inset-x-0 bottom-0 z-[60] border-t border-edge/85 bg-bg/96 px-2 pt-2 shadow-[0_-18px_42px_rgba(0,0,0,0.44)] backdrop-blur-2xl md:hidden">
      <div className="mx-auto flex max-w-[560px] items-stretch gap-1 overflow-x-auto no-scrollbar">
        {visibleItems.map((item) => {
          const active = path === item.href || (item.href !== "/" && path.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={(event) => {
                if (item.href === "/artist") setUserMode("ARTIST");
                navigate(item.href)(event);
              }}
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-[54px] min-w-[62px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 text-center transition ${
                active
                  ? "border-neon/45 bg-neon/13 text-neon shadow-[inset_0_0_16px_rgba(0,229,114,0.08),0_0_18px_rgba(0,229,114,0.13)]"
                  : "border-transparent text-mute hover:border-edge hover:bg-white/[0.045] hover:text-ink"
              }`}
            >
              <span className={`grid h-6 place-items-center transition ${active ? "scale-105" : "group-active:scale-95"}`}>
                <MobileNavIcon item={item} />
              </span>
              <span className="max-w-full whitespace-nowrap text-[9px] font-black uppercase leading-none tracking-[0.04em] min-[390px]:text-[9.5px]">
                {mobileNavLabel(item.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
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

function MobileWalletSummary({
  mounted,
  address,
  provider,
  audius,
  paperMode,
  isPaperWallet,
  hasExternalWallet,
}: {
  mounted: boolean;
  address: string | null;
  provider: string | null;
  audius: AudiusProfile | null;
  paperMode: boolean;
  isPaperWallet: boolean;
  hasExternalWallet: boolean;
}) {
  const { formatUsd } = useUsdToDisplayRate();
  const { setSession, clearAudius } = useSession();
  const { openLoginModal, setUserMode } = useUI();
  const { setEnabled: setPaperMode } = usePaperTrading();
  const native = useNativeBalance(hasExternalWallet ? address : null, hasExternalWallet ? "solana" : null);
  const audioBalance = useAudiusAudioBalance(audius?.handle);
  if (!mounted) return null;
  if (!hasExternalWallet && !audius && !paperMode) return null;

  const short = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;
  const audiusWallet = audius?.wallets?.sol || null;
  const shortAudiusWallet = audiusWallet ? `${audiusWallet.slice(0, 4)}…${audiusWallet.slice(-4)}` : "Not exposed";
  const audio = audioBalance ?? audius?.audioBalance ?? null;
  const openArtistWalletConnect = () => {
    setUserMode("ARTIST");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("walletConnect", "phantom");
      url.searchParams.set("walletRole", "ARTIST");
      url.searchParams.set("walletConnectSource", "mobile-header");
      if (audius?.handle) url.searchParams.set("audiusHandle", audius.handle);
      if (audius?.userId) url.searchParams.set("audiusUserId", audius.userId);
      if (audius?.name) url.searchParams.set("audiusName", audius.name);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    openLoginModal();
  };
  const disconnectExternalWallet = async () => {
    if (provider && provider !== "audius" && provider !== PAPER_WALLET_PROVIDER) {
      await disconnectWallet(provider as WalletId);
    }
    setSession({ address: null, kind: null, provider: null });
    if (audius) setUserMode("ARTIST");
  };
  const signOutAudius = () => {
    clearAudius();
    if (!hasExternalWallet && !paperMode) setUserMode("INVESTOR");
  };
  const turnOffPaperWallet = () => {
    setPaperMode(false);
    if (isPaperWallet || provider === PAPER_WALLET_PROVIDER) {
      setSession({ address: null, kind: null, provider: null });
    }
  };

  return (
    <div className="md:hidden border-t border-edge/60 py-2">
      <div className="grid min-w-0 grid-cols-1 gap-2 px-0.5">
        {hasExternalWallet ? (
          <div className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-neon/25 bg-neon/10 px-3 py-2 text-left">
            <span className="h-2 w-2 shrink-0 rounded-full bg-neon shadow-[0_0_8px_rgba(0,229,114,0.75)]" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-neon">External wallet</span>
              <span className="truncate font-mono text-xs font-black text-ink">
                {native.error ? "Balance unavailable" : native.balance != null ? `${native.balance.toFixed(3)} SOL` : "Loading SOL"}
              </span>
            </span>
            <span className="max-w-[34%] shrink-0 truncate text-right font-mono text-[11px] font-bold text-mute">
              {native.usd != null ? formatUsd(native.usd) : short}
            </span>
            <button
              type="button"
              onClick={disconnectExternalWallet}
              className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neon/25 bg-black/20 text-neon/80 transition hover:bg-neon/15 hover:text-neon active:scale-95"
              title="Disconnect external wallet"
              aria-label="Disconnect external wallet"
            >
              <X size={14} />
            </button>
          </div>
        ) : paperMode || isPaperWallet || provider === PAPER_WALLET_PROVIDER ? (
          <div className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-neon/25 bg-neon/10 px-3 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-neon shadow-[0_0_8px_rgba(0,229,114,0.75)]" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-neon">Paper wallet</span>
              <span className="truncate font-mono text-xs font-black text-ink">100 SOL · 2.5K AUDIO</span>
            </span>
            <button
              type="button"
              onClick={turnOffPaperWallet}
              className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neon/25 bg-black/20 text-neon/80 transition hover:bg-neon/15 hover:text-neon active:scale-95"
              title="Turn off Paper Mode"
              aria-label="Turn off Paper Mode"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {audius ? (
          <div className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-violet/25 bg-violet/10 px-3 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-violet shadow-[0_0_8px_rgba(155,81,224,0.75)]" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="whitespace-normal break-words text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-violet">
                {audius.name || `@${audius.handle}`}
              </span>
              <span className="mt-0.5 truncate font-mono text-xs font-black text-ink">
                {audio != null ? `${audio.toLocaleString(undefined, { maximumFractionDigits: 0 })} AUDIO` : "Audius synced"}
              </span>
              <span className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-mute">
                Audius wallet {shortAudiusWallet}
              </span>
            </span>
            <button
              type="button"
              onClick={signOutAudius}
              className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet/25 bg-black/20 text-violet/85 transition hover:bg-violet/15 hover:text-violet active:scale-95"
              title="Sign out of Audius"
              aria-label="Sign out of Audius"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {audius && !hasExternalWallet ? (
          <button
            type="button"
            onClick={openArtistWalletConnect}
            className="btn-primary min-h-11 w-full px-3 text-[10px] font-black uppercase tracking-[0.14em]"
          >
            Connect external wallet
          </button>
        ) : null}
      </div>
    </div>
  );
}
