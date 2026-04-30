"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, type AudiusProfile } from "@/lib/store";
import { getSolBalance, getEvmBalance, getSolPriceUsd } from "@/lib/balance";
import { SafeImage } from "./SafeImage";

interface BalState { balance: number | null; usd: number | null }
interface TokenRow {
  mint: string;
  amount: number;
  ticker: string;
  name: string;
  logo_uri: string | null;
  price: number | null;
  valueUsd: number | null;
  isAudio: boolean;
  isArtistCoin: boolean;
}
interface Holdings {
  tokens: TokenRow[];
  totalUsd: number;
  audioBalance: number;
  artistCoinCount: number;
}

function fmtNum(n: number) {
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
function fmtUsd(n: number) {
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function useNativeBalance(address: string | null | undefined, kind: "solana" | "evm" | null) {
  const [s, setS] = useState<BalState>({ balance: null, usd: null });
  useEffect(() => {
    if (!address) { setS({ balance: null, usd: null }); return; }
    let alive = true;
    const load = async () => {
      try {
        const b = kind === "evm"
          ? await getEvmBalance(address)
          : await getSolBalance(address);
        if (!alive) return;
        let usd: number | null = null;
        if (kind !== "evm") {
          const px = await getSolPriceUsd();
          usd = b * px;
        }
        if (alive) setS({ balance: b, usd });
      } catch { /* keep last */ }
    };
    load();
    const i = setInterval(load, 25_000);
    return () => { alive = false; clearInterval(i); };
  }, [address, kind]);
  return s;
}

function useTokenHoldings(address: string | null | undefined) {
  const [h, setH] = useState<Holdings | null>(null);
  useEffect(() => {
    if (!address) { setH(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/wallet/tokens?address=${address}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (alive) setH(j);
      } catch { /* ignore */ }
    };
    load();
    const i = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(i); };
  }, [address]);
  return h;
}

/** Poll Audius public profile for the unified AUDIO balance. */
export function useAudiusAudioBalance(handle: string | null | undefined) {
  const [bal, setBal] = useState<number | null>(null);
  useEffect(() => {
    if (!handle) { setBal(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/audius/profile?handle=${encodeURIComponent(handle)}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (alive && typeof j?.profile?.audioBalance === "number") {
          setBal(j.profile.audioBalance);
        }
      } catch { /* ignore */ }
    };
    load();
    const i = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(i); };
  }, [handle]);
  return bal;
}

export function WalletBalance() {
  const { address, kind, audius, setSession } = useSession();
  const trading = useNativeBalance(address ?? null, kind ?? null);

  // Backfill wallets for sessions persisted before we shipped this field —
  // re-fetch the public profile by handle so the SPL wallet address shows up.
  useEffect(() => {
    if (!audius?.handle) return;
    if (audius.wallets?.sol) return;
    let alive = true;
    fetch(`/api/audius/profile?handle=${encodeURIComponent(audius.handle)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.profile) return;
        const merged: AudiusProfile = { ...audius, ...j.profile };
        setSession({ audius: merged });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [audius?.handle, audius?.wallets?.sol]);

  const liveAudio = useAudiusAudioBalance(audius?.handle);
  const audioBalance = liveAudio ?? audius?.audioBalance ?? null;
  const audiusAddr = audius?.wallets?.sol ?? null;
  const audiusTokens = useTokenHoldings(audiusAddr);
  const tradingAddr = kind === "solana" ? address ?? null : null;
  const tradingTokens = useTokenHoldings(tradingAddr);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const showTrading = !!address;
  const showAudius = !!audius;
  if (!showTrading && !showAudius) return null;

  return (
    <div className="hidden sm:flex items-center gap-2 relative" ref={ref}>
      {showTrading && (
        <div className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/40 text-white/80 flex items-center gap-2 shadow-inner" title="Trading wallet">
          <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_5px_rgba(0,229,114,0.8)]" />
          <span className="num font-bold text-white tracking-wider">
            {trading.balance != null ? trading.balance.toFixed(4) : "—"}
          </span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">{kind === "solana" ? "SOL" : "ETH"}</span>
          {trading.usd != null && trading.usd > 0 && (
            <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">· ${trading.usd.toFixed(2)}</span>
          )}
          {tradingTokens && tradingTokens.tokens.length > 0 && (
            <span className="text-violet font-bold text-[10px]" title={`${tradingTokens.tokens.length} tokens`}>
              +{tradingTokens.tokens.length}
            </span>
          )}
        </div>
      )}
      {showAudius && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 rounded-lg border border-violet/30 bg-violet/10 text-white/80 flex items-center gap-2 hover:bg-violet/20 transition cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
          title={`Audius wallet @${audius?.handle} — click for details`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet shadow-[0_0_5px_rgba(155,81,224,0.8)]" />
          <span className="num font-bold text-white tracking-wider">{audioBalance != null ? fmtNum(audioBalance) : "—"}</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-violet">$AUDIO</span>
          {audiusTokens && audiusTokens.artistCoinCount > 0 && (
            <span className="text-violet font-bold text-[10px]">+{audiusTokens.artistCoinCount}</span>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
            className="absolute right-0 top-11 w-[400px] rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl p-4 z-50 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/50 truncate flex items-center gap-1.5">
                Audius Vault · <span className="text-white truncate max-w-[150px]">{audius?.name || `@${audius?.handle}`}</span>
              </div>
              {audiusTokens && audiusTokens.totalUsd > 0 && (
                <span className="text-[10px] font-mono text-neon bg-neon/10 px-2 py-0.5 rounded font-bold border border-neon/20">{fmtUsd(audiusTokens.totalUsd)}</span>
              )}
            </div>

            {/* Total AUDIO row (always shown if balance known) */}
            {audioBalance != null && (
              <div className="flex items-center gap-3 py-3 border-b border-white/10 mb-2">
                <div className="w-8 h-8 rounded bg-violet/20 grid place-items-center text-violet font-bold text-sm shadow-[0_0_10px_rgba(155,81,224,0.3)]">
                  ♪
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white tracking-wide">$AUDIO</div>
                  <div className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">Global Network Balance</div>
                </div>
                <div className="text-right">
                  <div className="text-xs num font-bold text-white tracking-wider">{fmtNum(audioBalance)}</div>
                  <div className="text-[9px] uppercase tracking-widest text-white/40 mt-0.5">AUDIO</div>
                </div>
              </div>
            )}

            {audiusTokens && audiusTokens.tokens.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto divide-y divide-white/5 pr-1">
                {audiusTokens.tokens.filter((t) => !t.isAudio).map((t) => (
                  <li key={t.mint}>
                    {t.isArtistCoin ? (
                      <Link
                        href={`/coin/${t.mint}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-3 hover:bg-white/5 transition px-2 -mx-2 rounded-lg group"
                      >
                        <Logo t={t} />
                        <Body t={t} />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 py-3 px-2 -mx-2">
                        <Logo t={t} />
                        <Body t={t} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              audioBalance != null && audioBalance === 0 && (
                <div className="text-white/30 text-[10px] uppercase tracking-widest font-bold py-6 text-center">
                  Vault is empty
                </div>
              )
            )}

            <div className="mt-4 pt-3 border-t border-white/10 space-y-1">
              <div className="text-[9px] text-white/30 font-mono break-all flex items-center justify-between">
                <span className="font-bold uppercase tracking-widest text-white/50">SPL</span> {audiusAddr ?? "—"}
              </div>
              {audius?.wallets?.eth && (
                <div className="text-[9px] text-white/30 font-mono break-all flex items-center justify-between">
                  <span className="font-bold uppercase tracking-widest text-white/50">ETH</span> {audius.wallets.eth}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Logo({ t }: { t: TokenRow }) {
  return (
    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-lg">
      <SafeImage
        src={t.logo_uri}
        fill sizes="32px" alt={t.ticker} fallback={t.ticker}
        className="object-cover"
      />
    </div>
  );
}
function Body({ t }: { t: TokenRow }) {
  return (
    <>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-white tracking-wide truncate group-hover:text-neon transition">${t.ticker}</div>
        <div className="text-[9px] text-white/50 uppercase tracking-widest truncate mt-0.5">{t.name}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs num font-bold text-white tracking-wider">{fmtNum(t.amount)}</div>
        {t.valueUsd != null && t.valueUsd > 0 && (
          <div className="text-[9px] uppercase tracking-widest text-neon font-bold mt-0.5">{fmtUsd(t.valueUsd)}</div>
        )}
      </div>
    </>
  );
}
