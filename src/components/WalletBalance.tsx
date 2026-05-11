"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, type AudiusProfile } from "@/lib/store";
import { SafeImage } from "./SafeImage";
import { formatFiat, priceAgeText } from "@/lib/fiat";

interface BalState {
  balance: number | null;
  usd: number | null;
  address: string | null;
  network: string | null;
  rpc: string | null;
  updatedAt: string | null;
  error: string | null;
}
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
  return formatFiat(n, "USD");
}

function shortAddr(address: string | null | undefined) {
  if (!address) return "—";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function useNativeBalance(address: string | null | undefined, kind: "solana" | null) {
  const [s, setS] = useState<BalState>({
    balance: null,
    usd: null,
    address: null,
    network: null,
    rpc: null,
    updatedAt: null,
    error: null,
  });
  useEffect(() => {
    if (!address) {
      setS({ balance: null, usd: null, address: null, network: null, rpc: null, updatedAt: null, error: null });
      return;
    }
    let alive = true;
    let loading = false;
    const load = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        setS((prev) => ({
          ...prev,
          address,
          error: null,
          balance: prev.address === address ? prev.balance : null,
          usd: prev.address === address ? prev.usd : null,
        }));
        const res = await fetch(`/api/wallet/sol-balance?address=${encodeURIComponent(address)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Could not load wallet balance");
        if (!alive) return;
        setS({
          balance: Number(json?.sol ?? 0),
          usd: Number(json?.usd ?? 0),
          address: json?.address || address,
          network: json?.network || null,
          rpc: json?.rpc || null,
          updatedAt: json?.updatedAt || null,
          error: null,
        });
      } catch (err) {
        if (!alive) return;
        setS((prev) => ({
          ...prev,
          address,
          error: err instanceof Error ? err.message : "Could not load wallet balance",
        }));
      } finally {
        loading = false;
      }
    };
    load();
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ address?: string | null }>).detail;
      if (!detail?.address || detail.address === address) load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("songdaq:wallet-refresh", onRefresh);
    const i = setInterval(load, 5_000);
    return () => {
      alive = false;
      clearInterval(i);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("songdaq:wallet-refresh", onRefresh);
    };
  }, [address, kind]);
  return s;
}

function useTokenHoldings(address: string | null | undefined, mode: "summary" | "full" = "summary") {
  const [h, setH] = useState<Holdings | null>(null);
  useEffect(() => {
    if (!address) { setH(null); return; }
    let alive = true;
    let loading = false;
    const load = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const r = await fetch(`/api/wallet/tokens?address=${encodeURIComponent(address)}&mode=${mode}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (alive) setH(j);
      } catch { /* ignore */ }
      finally { loading = false; }
    };
    load();
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ address?: string | null }>).detail;
      if (!detail?.address || detail.address === address) load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("songdaq:wallet-refresh", onRefresh);
    const i = setInterval(load, mode === "summary" ? 12_000 : 10_000);
    return () => {
      alive = false;
      clearInterval(i);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("songdaq:wallet-refresh", onRefresh);
    };
  }, [address, mode]);
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

export function WalletBalance({ compact = false }: { compact?: boolean } = {}) {
  const { address, kind, provider, audius, setSession } = useSession();
  const hasTradingWallet = !!address && provider !== "audius";
  const trading = useNativeBalance(hasTradingWallet ? address : null, hasTradingWallet ? kind ?? null : null);
  const [audioUsdPrice, setAudioUsdPrice] = useState(0);

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
  const [open, setOpen] = useState(false);
  const audiusTokens = useTokenHoldings(audiusAddr, open ? "full" : "summary");
  const tradingAddr = address ?? null;
  const tradingTokens = useTokenHoldings(hasTradingWallet ? tradingAddr : null, "summary");
  const isLinkedWallet = !!(address && audiusAddr && address === audiusAddr);
  const audioToken = audiusTokens?.tokens.find((t) => t.isAudio) ?? null;
  useEffect(() => {
    let alive = true;
    fetch("/api/coins?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const audio = (j?.coins ?? []).find((c: any) => String(c.ticker).toUpperCase() === "AUDIO");
        setAudioUsdPrice(Number(audio?.price ?? 0));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const audioValueUsd = audioToken?.valueUsd ?? ((audioBalance ?? 0) * audioUsdPrice);

  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const showTrading = hasTradingWallet;
  const showAudius = !!audius;
  if (!showTrading && !showAudius) return null;
  const tradingTitle = [
    isLinkedWallet ? "Linked Solana wallet" : "External trading wallet",
    `Address: ${trading.address || address || "—"}`,
    `Network: ${trading.network || process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta"}`,
    `RPC: ${trading.rpc || "loading"}`,
    `SOL: ${trading.balance != null ? trading.balance.toFixed(6) : "loading"}`,
    `USD: ${trading.usd != null ? fmtUsd(trading.usd) : "loading"}`,
    trading.updatedAt ? priceAgeText(trading.updatedAt) : null,
    trading.error ? `Status: ${trading.error}` : null,
  ].filter(Boolean).join("\n");

  if (compact) {
    return (
      <div className="hidden sm:flex items-center gap-1 relative min-w-0" ref={ref}>
        {showTrading && (
          <div
            className="h-8 px-2 rounded-xl border border-edge bg-panel2 text-ink flex items-center gap-1 min-w-0 shadow-inner"
            title={tradingTitle}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_5px_rgba(0,229,114,0.8)]" />
            <span className="num font-bold text-ink tracking-wider text-[10px] whitespace-nowrap">
              {trading.error ? "—" : trading.balance != null ? trading.balance.toFixed(3) : "…"} <span className="text-[8px] uppercase tracking-widest font-bold text-mute">SOL</span>
            </span>
            <span className="text-[8px] uppercase tracking-widest font-bold text-mute whitespace-nowrap">
              {trading.error ? shortAddr(address) : trading.usd != null ? `~${fmtUsd(trading.usd)}` : shortAddr(address)}
            </span>
          </div>
        )}
        {showAudius && (
          <button
            onClick={() => setOpen((v) => !v)}
            onMouseEnter={() => setOpen(true)}
            className="h-8 px-2 rounded-xl border border-violet/35 bg-violet/12 text-ink flex items-center gap-1 hover:bg-violet/20 transition cursor-pointer min-w-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            title={`Audius wallet @${audius?.handle}\nAUDIO: ${audioBalance != null ? fmtNum(audioBalance) : "0"}\nUSD: ${fmtUsd(audioValueUsd)}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet shadow-[0_0_5px_rgba(155,81,224,0.8)]" />
            <span className="num font-bold text-ink tracking-wider text-[10px] whitespace-nowrap">{audioBalance != null ? fmtNum(audioBalance) : "—"} <span className="text-[8px] uppercase tracking-widest font-bold text-violet">$AUDIO</span></span>
            <span className="text-[8px] uppercase tracking-widest text-mute whitespace-nowrap">~{fmtUsd(audioValueUsd)}</span>
          </button>
        )}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
              className="absolute right-0 top-11 w-[min(400px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-xl border border-edge bg-panel backdrop-blur-xl p-4 z-50 shadow-2xl text-ink"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-mute truncate flex items-center gap-1.5">
                  Audius Wallet · <span className="text-ink truncate max-w-[170px]">{audius?.name || `@${audius?.handle}`}</span>
                </div>
                {audiusTokens && audiusTokens.totalUsd > 0 && (
                  <span className="text-[10px] font-mono text-neon bg-neon/10 px-2 py-0.5 rounded font-bold border border-neon/20">{fmtUsd(audiusTokens.totalUsd)}</span>
                )}
              </div>

              {audioBalance != null && (
                <div className="flex items-center gap-3 py-3 border-b border-edge mb-2">
                  <div className="w-8 h-8 rounded bg-violet/20 grid place-items-center text-violet font-bold text-sm shadow-[0_0_10px_rgba(155,81,224,0.3)]">
                    ♪
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-ink tracking-wide">$AUDIO</div>
                    <div className="text-[9px] text-mute uppercase tracking-widest mt-0.5">Audius wallet AUDIO · USD shown below</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs num font-bold text-ink tracking-wider">{fmtNum(audioBalance)}</div>
                    <div className="text-[9px] uppercase tracking-widest text-mute mt-0.5">{fmtUsd(audioValueUsd)}</div>
                  </div>
                </div>
              )}

              {audiusTokens && audiusTokens.tokens.length > 0 ? (
                <ul className="max-h-72 overflow-y-auto divide-y divide-white/[0.08] pr-1">
                  {audiusTokens.tokens.filter((t) => !t.isAudio).map((t) => (
                    <li key={t.mint}>
                      {t.isArtistCoin ? (
                        <Link
                          href={`/coin/${t.mint}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 py-3 hover:bg-white/[0.08] transition px-2 -mx-2 rounded-lg group"
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
                  <div className="text-mute text-[10px] uppercase tracking-widest font-bold py-6 text-center">
                    Vault is empty
                  </div>
                )
              )}

              <div className="mt-4 pt-3 border-t border-edge space-y-1">
                <div className="text-[9px] text-mute font-mono break-all flex items-center justify-between">
                  <span className="font-bold uppercase tracking-widest text-ink">SPL</span> {audiusAddr ?? "—"}
                </div>
                {audius?.wallets?.eth && (
                  <div className="text-[9px] text-mute font-mono break-all flex items-center justify-between">
                    <span className="font-bold uppercase tracking-widest text-ink">ETH</span> {audius.wallets.eth}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center gap-1.5 relative min-w-0" ref={ref}>
      {showTrading && (
        <div
          className={`rounded-xl border border-edge bg-panel2 text-ink flex items-center min-w-0 shadow-inner ${compact ? "h-8 px-2 gap-1.25" : "h-10 px-2.5 xl:px-3 gap-1.5 xl:gap-2"}`}
          title={tradingTitle}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_5px_rgba(0,229,114,0.8)]" />
          <span className={`uppercase tracking-widest font-bold text-mute whitespace-nowrap ${compact ? "text-[8px]" : "text-[9px] xl:text-[10px]"}`}>{isLinkedWallet ? "Linked" : "External"}</span>
          <span className="flex flex-col items-start leading-none min-w-0">
            <span className={`num font-bold text-ink tracking-wider ${compact ? "text-[10px]" : "text-[11px] xl:text-[12px]"}`}>
              {trading.error ? "—" : trading.balance != null ? trading.balance.toFixed(compact ? 3 : 4) : "…"} <span className={`uppercase tracking-widest font-bold text-mute ${compact ? "text-[8px]" : "text-[9px] xl:text-[10px]"}`}>SOL</span>
            </span>
            <span className={`uppercase tracking-widest font-bold text-mute ${compact ? "text-[8px]" : "text-[9px]"}`}>
              {trading.error ? shortAddr(address) : trading.usd != null ? `${fmtUsd(trading.usd)} USD` : shortAddr(address)}
            </span>
          </span>
          {tradingTokens && tradingTokens.tokens.length > 0 && (
            <span className={`text-violet font-bold shrink-0 ${compact ? "text-[8px]" : "text-[10px]"}`} title={`${tradingTokens.tokens.length} tokens`}>
              +{tradingTokens.tokens.length}
            </span>
          )}
        </div>
      )}
      {showAudius && (
        <button
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setOpen(true)}
          className={`rounded-xl border border-violet/35 bg-violet/12 text-ink flex items-center hover:bg-violet/20 transition cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] min-w-0 ${compact ? "h-8 px-2 gap-1.25" : "h-10 px-2.5 xl:px-3 gap-1.5 xl:gap-2"}`}
          title={`Audius wallet @${audius?.handle}\nAUDIO: ${audioBalance != null ? fmtNum(audioBalance) : "0"}\nUSD: ${fmtUsd(audioValueUsd)}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet shadow-[0_0_5px_rgba(155,81,224,0.8)]" />
          <span className={`uppercase tracking-widest font-bold text-violet whitespace-nowrap ${compact ? "text-[8px]" : "text-[9px] xl:text-[10px]"}`}>Audius</span>
          <span className="flex flex-col items-start leading-none">
            <span className={`num font-bold text-ink tracking-wider ${compact ? "text-[10px]" : "text-[11px] xl:text-[12px]"}`}>{audioBalance != null ? fmtNum(audioBalance) : "—"} <span className={`uppercase tracking-widest font-bold text-violet ${compact ? "text-[8px]" : "text-[9px] xl:text-[10px]"}`}>$AUDIO</span></span>
            <span className={`uppercase tracking-widest font-bold text-mute ${compact ? "text-[8px]" : "text-[9px]"}`}>
              {fmtUsd(audioValueUsd)} USD
            </span>
          </span>
          {audiusTokens && audiusTokens.artistCoinCount > 0 && (
            <span className={`text-violet font-bold ${compact ? "text-[8px]" : "text-[10px]"}`}>+{audiusTokens.artistCoinCount}</span>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
            className="absolute right-0 top-11 w-[min(400px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-xl border border-edge bg-panel backdrop-blur-xl p-4 z-50 shadow-2xl text-ink"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-mute truncate flex items-center gap-1.5">
                Audius Wallet · <span className="text-ink truncate max-w-[170px]">{audius?.name || `@${audius?.handle}`}</span>
              </div>
              {audiusTokens && audiusTokens.totalUsd > 0 && (
                <span className="text-[10px] font-mono text-neon bg-neon/10 px-2 py-0.5 rounded font-bold border border-neon/20">{fmtUsd(audiusTokens.totalUsd)}</span>
              )}
            </div>

            {/* Total AUDIO row (always shown if balance known) */}
            {audioBalance != null && (
              <div className="flex items-center gap-3 py-3 border-b border-edge mb-2">
                <div className="w-8 h-8 rounded bg-violet/20 grid place-items-center text-violet font-bold text-sm shadow-[0_0_10px_rgba(155,81,224,0.3)]">
                  ♪
                </div>
                <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-ink tracking-wide">$AUDIO</div>
                  <div className="text-[9px] text-mute uppercase tracking-widest mt-0.5">Audius wallet AUDIO · USD shown below</div>
                </div>
                <div className="text-right">
                  <div className="text-xs num font-bold text-ink tracking-wider">{fmtNum(audioBalance)}</div>
                  <div className="text-[9px] uppercase tracking-widest text-mute mt-0.5">
                    {fmtUsd(audioValueUsd)}
                  </div>
                </div>
              </div>
            )}

            {audiusTokens && audiusTokens.tokens.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto divide-y divide-white/[0.08] pr-1">
                {audiusTokens.tokens.filter((t) => !t.isAudio).map((t) => (
                  <li key={t.mint}>
                    {t.isArtistCoin ? (
                      <Link
                        href={`/coin/${t.mint}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-3 hover:bg-white/[0.08] transition px-2 -mx-2 rounded-lg group"
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
                <div className="text-mute text-[10px] uppercase tracking-widest font-bold py-6 text-center">
                  Vault is empty
                </div>
              )
            )}

            <div className="mt-4 pt-3 border-t border-edge space-y-1">
              <div className="text-[9px] text-mute font-mono break-all flex items-center justify-between">
                <span className="font-bold uppercase tracking-widest text-ink">SPL</span> {audiusAddr ?? "—"}
              </div>
              {audius?.wallets?.eth && (
                <div className="text-[9px] text-mute font-mono break-all flex items-center justify-between">
                  <span className="font-bold uppercase tracking-widest text-ink">ETH</span> {audius.wallets.eth}
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
    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-panel2 border border-edge shrink-0 shadow-lg">
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
        <div className="text-xs font-bold text-ink tracking-wide truncate group-hover:text-neon transition">${t.ticker}</div>
        <div className="text-[9px] text-mute uppercase tracking-widest truncate mt-0.5">{t.name}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs num font-bold text-ink tracking-wider">{fmtNum(t.amount)}</div>
        {t.valueUsd != null && t.valueUsd > 0 && (
          <div className="text-[9px] uppercase tracking-widest text-neon font-bold mt-0.5">{fmtUsd(t.valueUsd)}</div>
        )}
      </div>
    </>
  );
}
