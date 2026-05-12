"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SafeImage } from "./SafeImage";
import { useCoins } from "@/lib/useCoins";
import { Search, Command, CornerDownLeft, ArrowDown, ArrowUp, Star, TrendingUp, Music, Settings, Zap } from "lucide-react";

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  hint?: string;
  href: string;
  logo?: string | null;
  icon?: React.ReactNode;
}

const STATIC_ITEMS: Item[] = [
  { id: "nav-market", title: "Market", subtitle: "Live Artist Coins + Song Coins", href: "/market", hint: "System", icon: <TrendingUp size={14} className="text-neon" /> },
  { id: "nav-portfolio", title: "Asset Portfolio", subtitle: "Holdings & performance analytics", href: "/portfolio", hint: "System", icon: <Star size={14} className="text-gold" /> },
  { id: "nav-social", title: "Social Feed", subtitle: "Community intelligence & sentiment", href: "/social", hint: "Network", icon: <Zap size={14} className="text-violet" /> },
  { id: "nav-artist", title: "Artist Studio", subtitle: "Token issuance & verification", href: "/artist", hint: "Protocol", icon: <Music size={14} className="text-violet" /> },
  { id: "nav-faq", title: "Support Center", subtitle: "Documentation & FAQ", href: "/faq", hint: "System", icon: <Settings size={14} className="text-mute" /> },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { coins } = useCoins("marketCap");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items: Item[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    const coinItems: Item[] = coins.slice(0, 50).map((c) => ({
      id: `coin-${c.mint}`,
      title: `$${c.ticker}`,
      subtitle: c.artist_name ?? c.name,
      logo: c.logo_uri,
      href: `/coin/${c.mint}`,
      hint: "Asset",
    }));
    const all = [...STATIC_ITEMS, ...coinItems];
    if (!query) return all.slice(0, 12);
    return all
      .map((it) => {
        const hay = `${it.title} ${it.subtitle ?? ""}`.toLowerCase();
        const score = hay.includes(query) ? hay.indexOf(query) : -1;
        return { it, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map((x) => x.it);
  }, [q, coins]);

  useEffect(() => { setActive(0); }, [q, open]);

  function go(it: Item) {
    router.push(it.href);
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-ink/30 backdrop-blur-lg grid place-items-start pt-[10vh] px-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: -16, opacity: 0, filter: "blur(8px)" }}
            animate={{ scale: 1, y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ scale: 0.96, y: -16, opacity: 0, filter: "blur(4px)" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="w-full max-w-[640px] mx-auto rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.72)] border border-edge overflow-hidden bg-panel backdrop-blur-3xl text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-edge relative">
              <Search className="text-mute shrink-0" size={18} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                  if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active]); }
                }}
                placeholder="Search assets, markets, protocols…"
                className="flex-1 !bg-transparent !border-none !p-0 text-base font-medium text-ink placeholder-mute focus:!ring-0 focus:!shadow-none outline-none"
              />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.075] border border-edge text-[9px] uppercase tracking-widest font-black text-mute">
                <Command size={9} /> K
              </div>
            </div>

            {/* Results */}
            <ul className="max-h-[420px] overflow-y-auto p-2 space-y-0.5 no-scrollbar">
              {!items.length && (
                <li className="px-6 py-14 text-center space-y-2">
                  <div className="text-mute text-sm font-bold uppercase tracking-widest">No results found</div>
                  <div className="text-mute text-[10px] uppercase tracking-widest">Try adjusting your search</div>
                </li>
              )}
              {items.map((it, i) => {
                const isSelected = i === active;
                return (
                  <li key={it.id}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(it)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all duration-200 relative ${
                        isSelected ? "bg-white/[0.04]" : ""
                      }`}
                    >
                      <div className={`relative w-9 h-9 rounded-xl overflow-hidden shrink-0 border transition-all flex items-center justify-center ${
                        isSelected ? "border-edge bg-white/[0.08]" : "border-edge bg-white/[0.045]"
                      }`}>
                        {it.logo ? (
                          <SafeImage src={it.logo} fill sizes="36px" alt={it.title} fallback={it.title} className="object-cover" />
                        ) : it.icon ? (
                          it.icon
                        ) : (
                          <div className="text-xs text-mute font-black">?</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold tracking-tight transition ${isSelected ? "text-ink" : "text-mute"}`}>{it.title}</div>
                        {it.subtitle && <div className="text-[11px] truncate transition text-mute">{it.subtitle}</div>}
                      </div>
                      {it.hint && (
                        <div className={`text-[8px] uppercase tracking-widest font-black px-2 py-0.5 rounded-md border transition-all ${
                          isSelected ? "bg-neon/10 border-neon/20 text-neon" : "bg-white/[0.055] border-edge text-mute"
                        }`}>
                          {it.hint}
                        </div>
                      )}
                      {isSelected && (
                        <div className="ml-1 text-mute">
                          <CornerDownLeft size={12} />
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <footer className="px-6 py-3 border-t border-edge flex items-center justify-between text-[9px] uppercase tracking-widest font-black text-mute">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-1.5">
                  <ArrowUp size={9} /><ArrowDown size={9} />
                  <span className="ml-0.5">Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CornerDownLeft size={9} />
                  Execute
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.04]">ESC</span>
                Dismiss
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
