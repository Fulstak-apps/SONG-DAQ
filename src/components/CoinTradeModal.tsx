"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Pause, Play } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { PriceChart, type PricePointDTO } from "./PriceChart";
import { Glossary, WhyDidThisMove } from "./Tooltip";
import { WalletButton } from "./WalletButton";
import { usePaperTrading, usePlayer, useSession, useUI, type PlayerTrack } from "@/lib/store";
import { sendSerializedTransaction, type WalletId } from "@/lib/wallet";
import { toast } from "@/lib/toast";
import { fmtNum, fmtPct } from "@/lib/pricing";
import { formatCryptoWithFiat, formatFiatEstimate, priceAgeText, useLiveFiatPrices, useUsdToDisplayRate } from "@/lib/fiat";
import { CHART_RANGE_LABELS, CHART_RANGES, isFastRange, type ChartRange } from "@/lib/chartRanges";
import type { AudiusCoin } from "@/lib/audiusCoins";
import { calculateCoinRisk } from "@/lib/risk/calculateCoinRisk";
import { readJson } from "@/lib/safeJson";
import { useCoins } from "@/lib/useCoins";
import { WhyFansCanBuy } from "./WhyFansCanBuy";
import { pickAudiusArtwork } from "@/lib/audiusArtwork";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;
const SLIPPAGE_PRESETS = [
  { bps: "50", label: "Careful", detail: "0.5%" },
  { bps: "100", label: "Normal", detail: "1%" },
  { bps: "300", label: "Flexible", detail: "3%" },
];

function toRawAmount(value: string, decimals: number): string {
  const cleaned = value.trim();
  if (!cleaned || Number(cleaned) <= 0) return "0";
  const [whole, frac = ""] = cleaned.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0")).toString();
}

function fromRawAmount(value: string | number | undefined, decimals: number, digits = 4): string {
  if (value == null) return "—";
  const raw = BigInt(String(value));
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  const fracText = frac.toString().padStart(decimals, "0").slice(0, digits).replace(/0+$/, "");
  return fracText ? `${whole}.${fracText}` : whole.toString();
}

function slippagePercent(bps: string) {
  const value = Number(bps);
  if (!Number.isFinite(value)) return "1%";
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2).replace(/\.?0+$/, "")}%`;
}

function isRouteProblem(message: string | null) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("no live swap route") || lower.includes("liquidity") || lower.includes("not tradable") || lower.includes("no executable");
}

export function CoinTradeModal({
  coin,
  side: initialSide,
  onClose,
  onDone,
}: {
  coin: AudiusCoin | null;
  side: "BUY" | "SELL";
  onClose: () => void;
  onDone?: () => void;
}) {
  const { address, kind, provider, audius } = useSession();
  const { openLoginModal } = useUI();
  const { enabled: paperMode, record: recordPaperTrade } = usePaperTrading();
  const { current, playing, playTrack, toggle } = usePlayer();
  const { coins: allCoins } = useCoins("marketCap");
  const [side, setSide] = useState<"BUY" | "SELL">(initialSide);
  const [amount, setAmount] = useState(initialSide === "BUY" ? "0.07" : "100");
  const [slippageBps, setSlippageBps] = useState("100");
  const [busy, setBusy] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [points, setPoints] = useState<PricePointDTO[]>([]);
  const [range, setRange] = useState<ChartRange>("LIVE");
  const [chartType, setChartType] = useState<"line" | "candles">("line");
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [settleUsd, setSettleUsd] = useState<Record<"SOL" | "AUDIO", number>>({ SOL: 0, AUDIO: 0 });
  const [tracks, setTracks] = useState<any[]>([]);
  const loadingRef = useRef(false);
  const fiatIds = useMemo(() => ["SOL", "AUDIO", coin?.mint], [coin?.mint]);
  const { currency, prices: fiatPrices, updatedAt: fiatUpdatedAt } = useLiveFiatPrices(fiatIds);
  const { formatUsd: formatDisplayFiat, convertUsd } = useUsdToDisplayRate();

  const canSignSolanaSwap = kind === "solana" && !!provider && provider !== "audius" && provider !== "paper";
  const needsExternalWallet = !paperMode && !canSignSolanaSwap;

  useEffect(() => {
    setSide(initialSide);
    setAmount(initialSide === "BUY" ? "0.07" : "100");
  }, [initialSide, coin?.mint]);
  useEffect(() => {
    if (!coin) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [coin]);
  useEffect(() => { setErr(null); setOk(null); }, [coin?.mint, side]);
  useEffect(() => {
    setSettleUsd({
      SOL: Number(fiatPrices.SOL?.usd ?? 0),
      AUDIO: Number(fiatPrices.AUDIO?.usd ?? 0),
    });
  }, [fiatPrices]);

  useEffect(() => {
    if (!coin?.mint) return;
    const selectedCoin = coin;
    let alive = true;
    const load = async () => {
      if (loadingRef.current || document.visibilityState === "hidden") return;
      loadingRef.current = true;
      try {
        const r = await fetch(`/api/coins/${selectedCoin.mint}/history?range=${range}`, { cache: "no-store" });
        const j = await readJson<{ candles?: PricePointDTO[] }>(r);
          if (!alive) return;
          setPoints((j?.candles?.length ? j.candles : selectedCoin.price ? [{
            ts: new Date().toISOString(),
            open: selectedCoin.price,
            high: selectedCoin.price,
            low: selectedCoin.price,
            close: selectedCoin.price,
            volume: 0,
          }] : []) as PricePointDTO[]);
      } catch {
          if (alive) {
            setPoints(selectedCoin.price ? [{
              ts: new Date().toISOString(),
              open: selectedCoin.price,
              high: selectedCoin.price,
              low: selectedCoin.price,
              close: selectedCoin.price,
              volume: 0,
            }] : []);
          }
      } finally {
        loadingRef.current = false;
      }
    };
    load();
    const fast = isFastRange(range);
    const i = setInterval(load, fast ? 5_000 : 15_000);
    return () => { alive = false; clearInterval(i); };
  }, [coin?.mint, range]);

  useEffect(() => {
    if (!coin?.artist_handle) { setTracks([]); return; }
    let alive = true;
    fetch(`/api/audius/tracks?handle=${encodeURIComponent(coin.artist_handle)}`, { cache: "no-store" })
      .then((r) => r.ok ? readJson<{ tracks?: any[] }>(r) : { tracks: [] })
      .then((j) => { if (alive) setTracks(j?.tracks ?? []); })
      .catch(() => { if (alive) setTracks([]); });
    return () => { alive = false; };
  }, [coin?.artist_handle]);

  const route = useMemo(() => {
    if (!coin) return null;
    const settleMint = SOL_MINT;
    const settleDecimals = SOL_DECIMALS;
    return side === "BUY"
      ? {
          inputMint: settleMint,
          outputMint: coin.mint,
          inputDecimals: settleDecimals,
          outputDecimals: coin.decimals,
          inputTicker: "SOL",
          outputTicker: coin.ticker,
        }
      : {
          inputMint: coin.mint,
          outputMint: settleMint,
          inputDecimals: coin.decimals,
          outputDecimals: settleDecimals,
          inputTicker: coin.ticker,
          outputTicker: "SOL",
        };
  }, [coin, side]);
  const isSameAssetRoute = !!route && route.inputMint === route.outputMint;

  useEffect(() => {
    if (!route || paperMode || !canSignSolanaSwap) { setQuote(null); setQuoteLoading(false); return; }
    if (isSameAssetRoute) {
      setQuote(null);
      setQuoteLoading(false);
      setErr("You cannot buy AUDIO with AUDIO. Choose SOL for the Audius token, or use AUDIO to buy another song or artist token.");
      return;
    }
    const raw = toRawAmount(amount, route.inputDecimals);
    if (raw === "0") { setQuote(null); return; }
    let alive = true;
    const id = setTimeout(async () => {
      setQuoteLoading(true);
      setErr(null);
      try {
        const qs = new URLSearchParams({
          inputMint: route.inputMint,
          outputMint: route.outputMint,
          amount: raw,
          slippageBps,
        });
        const r = await fetch(`/api/jupiter?${qs.toString()}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "No executable route");
        if (alive) setQuote(j.quote);
      } catch (e: any) {
        if (alive) { setQuote(null); setErr(e.message ?? String(e)); }
      } finally {
        if (alive) setQuoteLoading(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [amount, route, slippageBps, paperMode, isSameAssetRoute, canSignSolanaSwap]);

  if (!coin) return null;
  const change = coin.priceChange24hPercent ?? 0;
  const risk = calculateCoinRisk(coin as any);
  const isOwner = Boolean(
    (audius?.userId && String(audius.userId) === String(coin.owner_id ?? "")) ||
    (audius?.handle && coin.artist_handle && audius.handle.toLowerCase() === coin.artist_handle.toLowerCase())
  );
  const chartPoints = points.length ? points : coin.price ? [{
    ts: new Date().toISOString(),
    open: coin.price,
    high: coin.price,
    low: coin.price,
    close: coin.price,
    volume: 0,
  }] : [];
  const rawOutUnits = route && quote?.outAmount ? Number(quote.outAmount) / 10 ** route.outputDecimals : null;
  const tokenUsd = Number(coin.price ?? fiatPrices[coin.mint]?.usdPrice ?? 0);
  const tokenFiat = convertUsd(tokenUsd) ?? Number(fiatPrices[coin.mint]?.usd ?? 0);
  const settleUsdRaw = {
    SOL: Number(fiatPrices.SOL?.usdPrice ?? 0),
    AUDIO: Number(fiatPrices.AUDIO?.usdPrice ?? 0),
  };
  const inputUnits = Number(amount || 0);
  const inputUsdValue = side === "BUY"
    ? inputUnits * (settleUsdRaw.SOL || 0)
    : inputUnits * (tokenUsd || 0);
  const inputUsd = convertUsd(inputUsdValue) ?? (
    side === "BUY"
      ? inputUnits * (settleUsd.SOL || 0)
      : inputUnits * (tokenFiat || 0)
  );
  const expectedOutFiat = rawOutUnits == null
    ? null
    : rawOutUnits * (route?.outputTicker === "SOL" ? settleUsd.SOL : tokenFiat);
  const expectedOut = route && quote
    ? `${fromRawAmount(quote.outAmount, route.outputDecimals, 4)} ${route.outputTicker} ${formatFiatEstimate(expectedOutFiat, currency)}`
    : "—";
  const priceImpact = quote?.priceImpactPct != null ? `${(Number(quote.priceImpactPct) * 100).toFixed(2)}%` : "—";
  const priceImpactUsd = quote?.priceImpactPct != null ? Math.abs(inputUsd * Number(quote.priceImpactPct)) : null;
  const routeProblem = isRouteProblem(err);
  const canSubmit = !busy && !quoteLoading && !isSameAssetRoute && Number(amount) > 0;
  const paperTokens = coin.price && coin.price > 0 ? inputUsdValue / coin.price : 0;
  const estimatedNetworkFeeSol = 0.003;
  const estimatedNetworkFeeUsd = settleUsd.SOL ? estimatedNetworkFeeSol * settleUsd.SOL : null;
  const totalFiatCost = side === "BUY" ? inputUsd + (estimatedNetworkFeeUsd ?? 0) : inputUsd - (estimatedNetworkFeeUsd ?? 0);
  const slippageFiat = inputUsd * (Number(slippageBps || 0) / 10_000);
  const currencyTitle = settleUsd.SOL
    ? `${formatCryptoWithFiat(Number(amount || 0), side === "BUY" ? "SOL" : coin.ticker, inputUsd, currency)} before fees. ${priceAgeText(fiatUpdatedAt)}.`
    : "Fiat estimate unavailable.";
  const visibleTracks = tracks.slice(0, 4);
  const linkedTrackCount = visibleTracks.filter((track) => !!linkedCoinForTrack(track)).length;
  const selectedSong = coin.audius_track_title || visibleTracks[0]?.title || "Artist token";
  const marketPulse = Number(coin.buy24h ?? 0) >= Number(coin.sell24h ?? 0) ? "More buys than sells" : "More sells than buys";
  const royaltyStatus = (coin as any).splitsLocked ? "Royalty split locked" : "Royalty not verified yet";
  const localCoin = Boolean((coin as any).isSongDaqLocal || (coin as any).source === "songdaq");
  const marketValueReliable = !localCoin || (coin as any).isMarketValueReliable !== false;
  const marketValueLabel = marketValueReliable && Number(coin.marketCap ?? 0) > 0 ? formatDisplayFiat(coin.marketCap ?? 0, 0) : "Not priced yet";
  const marketValueNote = String((coin as any).marketValueNote || "Public value appears after public liquidity and real trading data are available.");
  const coinArtwork = coin.logo_uri || coin.audius_track_artwork || coin.artist_avatar || (coin.mint ? `/api/token-image/${coin.mint}` : null);

  function trackArtwork(track: any) {
    return pickAudiusArtwork(track, coin?.audius_track_artwork ?? coin?.logo_uri ?? coin?.artist_avatar ?? null);
  }

  function trackToPlayerTrack(track: any): PlayerTrack {
    const artistHandle = coin?.artist_handle;
    return {
      id: `audius-track-${track.id}`,
      title: track.title ?? "Untitled",
      artist: track.user?.name ?? coin?.artist_name ?? coin?.name ?? "Artist",
      artwork: trackArtwork(track),
      streamUrl: `https://api.audius.co/v1/tracks/${track.id}/stream?app_name=songdaq`,
      href: track.permalink ?? (artistHandle ? `https://audius.co/${artistHandle}` : undefined),
    };
  }

  function linkedCoinForTrack(track: any) {
    const title = String(track.title ?? "").trim().toLowerCase();
    const trackId = String(track.id ?? "");
    const artistHandle = String(coin?.artist_handle ?? "").trim().toLowerCase();
    return allCoins.find((item) => {
      if (item.audius_track_id && String(item.audius_track_id) === trackId) return true;
      return !!title
        && String(item.audius_track_title ?? "").trim().toLowerCase() === title
        && String(item.artist_handle ?? "").trim().toLowerCase() === artistHandle;
    });
  }

  function createSongCoinHref(track: any) {
    const params = new URLSearchParams();
    const trackId = String(track?.id ?? "");
    if (trackId) params.set("trackId", trackId);
    const trackTitle = String(track?.title ?? "");
    if (trackTitle) params.set("trackTitle", trackTitle);
    if (coin?.artist_handle) params.set("artist", coin.artist_handle);
    return `/artist?${params.toString()}`;
  }

  function playArtistTrack(track: any) {
    const next = trackToPlayerTrack(track);
    if (current?.id === next.id) toggle();
    else playTrack(next);
  }

  const artistSongsPanel = (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest font-black text-ink">Artist Songs</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-widest text-mute">
            {linkedTrackCount}/{visibleTracks.length || 0} shown have linked coins.
          </div>
        </div>
        <Link href={`/coin/${coin.mint}`} className="shrink-0 text-[11px] uppercase tracking-widest font-black text-neon hover:text-ink transition">
          Full coin →
        </Link>
      </div>
      <div className="space-y-2">
        {visibleTracks.length ? visibleTracks.map((track) => {
          const linkedCoin = linkedCoinForTrack(track);
          const player = trackToPlayerTrack(track);
          const isTrackPlaying = current?.id === player.id && playing;
          const linkedIsCurrent = linkedCoin?.mint === coin.mint;
          return (
            <div key={String(track.id ?? track.title)} className="rounded-xl border border-edge bg-panel2/70 p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-edge bg-panel">
                  <SafeImage src={player.artwork} alt={player.title} fill sizes="40px" fallback={coin.ticker} className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-black text-ink">{player.title}</div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-widest text-mute">{fmtNum(track.play_count ?? track.playCount ?? 0)} plays</div>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-black uppercase tracking-widest ${
                  linkedIsCurrent
                    ? "border-violet/30 bg-violet/10 text-violet"
                    : linkedCoin
                      ? "border-neon/25 bg-neon/10 text-neon"
                      : "border-edge bg-panel text-mute"
                }`}>
                  {linkedIsCurrent ? "This Coin" : linkedCoin ? "Coin On" : "No Coin"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn h-9 px-3 text-[11px] uppercase tracking-widest font-black" onClick={() => playArtistTrack(track)}>
                  {isTrackPlaying ? <Pause size={12} /> : <Play size={12} />}
                  {isTrackPlaying ? "Pause" : "Play"}
                </button>
                {linkedCoin ? (
                  <Link href={`/coin/${linkedCoin.mint}`} className="btn h-9 px-3 text-[11px] uppercase tracking-widest font-black">
                    {linkedIsCurrent ? "Current Coin" : "Open Coin"}
                  </Link>
                ) : isOwner ? (
                  <Link href={createSongCoinHref(track)} className="btn-primary h-9 px-3 text-[11px] uppercase tracking-widest font-black">
                    Create Coin
                  </Link>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-lg border border-edge bg-panel px-3 text-[11px] uppercase tracking-widest font-black text-mute">
                    No Coin Yet
                  </span>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="rounded-xl border border-edge bg-panel2/70 p-3 text-xs text-mute">
            {coin.artist_handle ? "Loading this artist's songs..." : "No Audius songs are attached to this artist yet."}
          </div>
        )}
      </div>
    </div>
  );

  async function submit() {
    if (paperMode) {
      if (!coin) return;
      const tokens = side === "BUY" ? paperTokens : Number(amount || 0);
      recordPaperTrade({
        mint: coin.mint,
        ticker: coin.ticker,
        side,
        inputAmount: Number(amount || 0),
        inputAsset: "SOL",
        settleAmount:
          side === "BUY"
            ? Number(amount || 0)
            : settleUsd.SOL
              ? Number(((Number(amount || 0) * (coin.price ?? 0)) / settleUsd.SOL).toFixed(4))
              : Number(amount || 0),
        tokenAmount: tokens,
        totalUsd: side === "BUY" ? inputUsdValue : tokens * (coin.price ?? 0),
      });
      setOk(`Paper ${side.toLowerCase()} saved · no wallet or money used`);
      toast.success("Paper trade saved", "Demo mode only. No blockchain transaction was sent.");
      onDone?.();
      return;
    }
    if (!address || !canSignSolanaSwap) {
      openLoginModal();
      setErr("Connect an external Solana wallet like Phantom, Solflare, or Backpack to buy or sell. Audius built-in wallet trading is coming later, but it cannot sign SONG·DAQ swaps yet.");
      return;
    }
    if (!quote) {
      setErr("No live swap route is available for this order yet. That usually means the token needs more liquidity or this trade size is too large.");
      return;
    }
    if (!route) {
      setErr("No route is available for this order");
      return;
    }
    if (side === "BUY" && !riskAccepted) {
      setErr("Confirm the investor risk disclosure before buying");
      return;
    }

    setBusy(true); setErr(null); setOk(null);
    try {
      const r = await fetch("/api/jupiter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quoteResponse: quote, userPublicKey: address }),
      });
      const j = await r.json();
      if (!r.ok || !j.swapTransaction) throw new Error(j.error || "Could not build swap transaction");
      const sig = await sendSerializedTransaction(provider as WalletId, j.swapTransaction);
      const rawOut = quote.outAmount ? Number(quote.outAmount) / 10 ** route.outputDecimals : 0;
      const rawIn = toRawAmount(amount, route.inputDecimals);
      const inputUnits = Number(rawIn) / 10 ** route.inputDecimals;
      const tradedTokens = side === "BUY" ? rawOut : inputUnits;
      const indexResponse = await fetch("/api/coins/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mint: coin!.mint,
          side,
          amount: tradedTokens,
          wallet: address,
          walletType: kind,
          txSig: sig,
          ticker: coin!.ticker,
          priceUsd: coin!.price ?? 0,
          totalUsd: (coin!.price ?? 0) * tradedTokens,
        }),
      }).catch((e) => ({ ok: false, json: async () => ({ error: e?.message || "Could not index trade" }) } as Response));
      if (!indexResponse.ok) {
        const indexError = await indexResponse.json().catch(() => ({}));
        toast.error("Trade confirmed, portfolio sync pending", indexError?.error || "Your wallet token balance may take a moment to appear in Portfolio.");
      }
      const msg = `${side === "BUY" ? "Bought" : "Sold"} $${coin!.ticker}`;
      setOk(`${msg} · ${sig.slice(0, 8)}…${sig.slice(-6)}`);
      toast.success(msg, `Confirmed on Solana · ${sig.slice(0, 8)}…${sig.slice(-6)}`);
      onDone?.();
    } catch (e: any) {
      const m = e.message ?? String(e);
      setErr(m);
      toast.error(`${side} failed`, m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="mobile-safe-overlay fixed inset-0 z-50 grid items-start justify-items-center overflow-y-auto bg-black/60 backdrop-blur-lg sm:place-items-center overscroll-contain"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ scale: 0.95, opacity: 0, y: 24, filter: "blur(4px)" }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
          className="mobile-safe-sheet relative w-full max-w-full sm:w-[min(1120px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl sm:rounded-3xl border border-edge bg-panel text-ink backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.65)] grain"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <header className="relative flex flex-wrap items-center gap-3 sm:gap-4 px-4 py-4 sm:px-6 sm:py-5 border-b border-edge">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-edge shrink-0 shadow-lg bg-panel2">
              <SafeImage src={coinArtwork} fill sizes="48px" alt={coin.ticker} fallback={coin.ticker} className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="font-black text-xl tracking-tighter text-ink">${coin.ticker}</div>
                <div className="min-w-0 text-[11px] text-mute whitespace-normal break-words uppercase tracking-widest font-bold">{coin.artist_name ?? coin.name}</div>
                {isOwner && <span className="chip-violet text-[11px]">Your coin</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1">
                <span className="font-mono text-lg font-bold tracking-tight text-ink">{formatDisplayFiat(coin.price ?? 0, 6)}</span>
                <span className={`num text-sm font-bold tracking-wider ${change >= 0 ? "text-neon" : "text-red"}`}>
                  {change >= 0 ? "▲" : "▼"} {fmtPct(change)}
                </span>
                <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                  <WhyDidThisMove symbol={coin.ticker} change={change} />
                  <Link href={`/coin/${coin.mint}`} className="text-[11px] uppercase tracking-widest text-mute hover:text-ink transition flex items-center gap-1 font-bold">
                    Full view <span className="text-neon">→</span>
                  </Link>
                </div>
              </div>
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.055] hover:bg-white/[0.1] transition text-mute hover:text-ink border border-edge" onClick={onClose}>×</button>
          </header>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px] relative z-10">
            <section className="order-2 p-4 sm:p-6 border-t lg:order-1 lg:border-t-0 lg:border-r border-edge">
              <div className="flex flex-col gap-2 mb-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="label">
                  <Glossary term="Price Chart" def="Real-time price indexed from Audius/Open Audio and observed route data." category="advanced">
                    Live Price · {currency}
                  </Glossary>
                  <div className="mt-1 text-[11px] uppercase tracking-widest font-black text-mute">Timeframe: <span className="text-neon">{CHART_RANGE_LABELS[range]}</span></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex max-w-full gap-0.5 overflow-x-auto no-scrollbar p-0.5 rounded-lg bg-white/[0.055] border border-edge">
                    {CHART_RANGES.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`shrink-0 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition ${
                          range === r ? "bg-neon/15 text-neon border border-neon/25" : "text-mute hover:text-ink hover:bg-white/10"
                        }`}
                      >{r}</button>
                    ))}
                  </div>
                  <div className="flex rounded-lg bg-white/[0.055] border border-edge p-0.5 text-[11px] font-bold uppercase tracking-widest">
                    {(["line", "candles"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setChartType(mode)}
                        className={`px-2.5 py-1 rounded-md transition ${chartType === mode ? "bg-white/10 text-ink" : "text-mute hover:text-ink"}`}
                      >
                        {mode === "line" ? "Line" : "Candles"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-[320px] overflow-hidden rounded-2xl border border-edge bg-panel2/60 p-2 sm:h-[360px] lg:h-[390px]">
                <PriceChart
                  points={chartPoints}
                  quote="USD"
                  height={340}
                  chartType={chartType}
                  live={isFastRange(range)}
                  mode="advanced"
                  showVolume
                  showMA7={false}
                  showMA25={false}
                  variant="investing"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                <ChartStat k="PUBLIC VALUE" v={marketValueLabel} tooltip={marketValueNote} />
                <ChartStat k="24H VOL" v={formatDisplayFiat(coin.v24hUSD ?? 0, 0)} tooltip="24 hour trading volume." />
                <ChartStat k="HOLDERS" v={fmtNum(coin.holder ?? 0)} tooltip="Unique wallets holding this token." />
              </div>
            </section>

            <section className="order-1 p-4 sm:p-6 space-y-5 bg-panel2/55 lg:order-2">
              <div className="flex bg-white/[0.055] border border-edge rounded-xl p-0.5">
                <button
                  onClick={() => setSide("BUY")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    side === "BUY" ? "bg-neon text-[#030303]" : "text-mute hover:text-ink"
                  }`}
                >Buy</button>
                <button
                  onClick={() => setSide("SELL")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    side === "SELL" ? "bg-red text-pure-white" : "text-mute hover:text-ink"
                  }`}
                >Sell</button>
              </div>

              <div className="flex items-center justify-between">
                <label className="label">
                  <Glossary
                    term={side === "BUY" ? "Pay with" : "Receive"}
                    def={side === "BUY"
                      ? "Real trading currently uses SOL from an external Solana wallet. Audius built-in wallet support is coming later."
                      : "Real selling currently pays back SOL to your external Solana wallet."}
                  >
                    {side === "BUY" ? "Pay with" : "Receive"}
                  </Glossary>
                </label>
                <span
                  className="rounded-lg border border-neon/25 bg-neon/10 px-3 py-1.5 text-xs font-mono font-black uppercase tracking-widest text-neon"
                  title={currencyTitle}
                >
                  SOL
                </span>
              </div>
              <div className="rounded-xl border border-amber/20 bg-amber/10 p-3 text-sm leading-relaxed text-amber/90">
                <div className="text-[11px] uppercase tracking-widest font-black text-amber">Audius wallet support coming soon</div>
                <p className="mt-1">
                  Audius login proves identity and can show your built-in Audius wallet balance. Real SONG·DAQ trades currently require an external Solana wallet like Phantom, Solflare, or Backpack.
                </p>
              </div>

              {needsExternalWallet && (
                <div className="rounded-xl border border-neon/20 bg-neon/10 p-3 text-sm leading-relaxed text-neon/90">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-widest font-black text-neon">External wallet required</div>
                      <p className="mt-1 text-neon/85">
                        Connect Phantom, Solflare, or Backpack before trading. If you do not have one installed, the wallet menu will send you to install it.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <WalletButton compact connectOnly />
                    </div>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="label">
                  <Glossary
                    term={side === "BUY" ? "Amount to spend" : "Amount to sell"}
                    def={side === "BUY"
                      ? "How much you want to spend before network fees. The app will estimate how many tokens you receive."
                      : "How many artist tokens you want to sell from your wallet."}
                  >
                    {side === "BUY" ? "Amount to spend" : "Amount to sell"}
                  </Glossary>
                </span>
                <div className="relative mt-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full !bg-panel border border-edge focus:border-neon/40 focus:ring-1 focus:ring-neon/20 rounded-xl pl-4 pr-24 py-3 text-lg font-mono font-bold text-ink transition placeholder-mute/70 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                    title={currencyTitle}
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <span className="rounded-lg border border-edge bg-panel2 px-2 py-1 text-mute font-mono text-xs uppercase">{route?.inputTicker}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-mute">
                  <span title={currencyTitle}>{formatFiatEstimate(inputUsd, currency)}</span>
                  {side === "BUY" && paperMode ? <span>≈ {fmtNum(paperTokens)} {coin.ticker}</span> : null}
                  <span>{priceAgeText(fiatUpdatedAt)}</span>
                </div>
              </label>

              <label className="block">
                <span className="label">
                  <Glossary
                    term="Price movement allowance"
                    def="This is how much the price is allowed to move while your wallet is signing. A lower number protects you more, but the trade can fail if the market moves. A higher number is more flexible, but you may get a slightly worse final price."
                    category="beginner"
                  >
                    Price movement allowance
                  </Glossary>
                </span>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SLIPPAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.bps}
                      type="button"
                      onClick={() => setSlippageBps(preset.bps)}
                      className={`rounded-xl border px-2 py-2 text-left transition ${
                        slippageBps === preset.bps ? "border-neon/40 bg-neon/10 text-neon" : "border-edge bg-panel text-mute hover:text-ink"
                      }`}
                    >
                      <span className="block text-[11px] font-black uppercase tracking-widest">{preset.label}</span>
                      <span className="mt-0.5 block font-mono text-xs">{preset.detail}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={slippageBps}
                    onChange={(e) => setSlippageBps(e.target.value)}
                    className="w-full !bg-panel border border-edge rounded-xl px-4 py-2 text-sm font-mono text-ink"
                  />
                  <span className="shrink-0 rounded-xl border border-edge bg-panel px-3 py-2 text-xs font-mono text-mute">
                    {slippagePercent(slippageBps)}
                  </span>
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-widest text-mute">
                  Max fiat movement estimate: <span className="text-ink">{formatFiatEstimate(slippageFiat, currency)}</span>
                </div>
              </label>

              <div className="rounded-xl bg-panel border border-edge p-4 space-y-2.5">
                <OrderRow
                  k={<Glossary term="Trading asset" def="The token or coin you are buying or selling. Check the artist, song, and token address before approving anything in your wallet.">Trading asset</Glossary>}
                  v={`$${coin.ticker}`}
                  highlight
                />
                <OrderRow
                  k={<Glossary term="Route" def="The path Jupiter uses on Solana to swap from one token into another. If no route exists, the token cannot be bought or sold through this button yet.">Route</Glossary>}
                  v={route ? `${route.inputTicker} → ${route.outputTicker}` : "—"}
                />
                <OrderRow
                  k={<Glossary term={side === "BUY" ? "Estimated tokens" : "Estimated proceeds"} def={side === "BUY" ? "The estimated number of artist tokens you will receive. The final number can move a little before your wallet confirms." : "The estimated amount you receive after selling. The final number can move a little before your wallet confirms."}>{side === "BUY" ? "Estimated tokens" : "Estimated proceeds"}</Glossary>}
                  v={quoteLoading ? "Finding route…" : expectedOut}
                  highlight
                />
                <OrderRow
                  k={<Glossary term="Fiat total" def="The estimated real-world currency value before you approve the wallet transaction. This is approximate and may move with live prices.">Fiat total</Glossary>}
                  v={formatFiatEstimate(totalFiatCost, currency)}
                  highlight
                />
                {paperMode && (
                  <OrderRow
                    k={<Glossary term="Demo estimate" def="Paper trade mode estimates the position locally. It does not send a transaction, spend money, or prove that live liquidity exists.">Demo estimate</Glossary>}
                    v={side === "BUY" ? `${fmtNum(paperTokens)} ${coin.ticker}` : formatDisplayFiat(Number(amount || 0) * (coin.price ?? 0), 2)}
                    highlight
                  />
                )}
                <div className="h-px bg-white/[0.03] w-full" />
                <OrderRow
                  k={<Glossary term="Price impact" def="How much your own trade is expected to move the price. Lower is better. High price impact means the market is thin or the trade is large.">Price impact</Glossary>}
                  v={`${priceImpact} · ${formatFiatEstimate(priceImpactUsd, currency)}`}
                />
                <OrderRow
                  k={<Glossary term="Estimated network fee" def="Solana charges a small network fee. This is an estimate so you can see the real-world cost before approving.">Estimated network fee</Glossary>}
                  v={formatCryptoWithFiat(estimatedNetworkFeeSol, "SOL", estimatedNetworkFeeUsd, currency)}
                />
                <OrderRow
                  k={<Glossary term="Router" def="Jupiter searches Solana markets for a live route and builds the swap for your wallet to approve.">Router</Glossary>}
                  v="Jupiter · Solana"
                />
                <OrderRow
                  k={<Glossary term="Token address" def="The Solana mint address for this token. Wallet approvals should match the token you intended to trade.">Token address</Glossary>}
                  v={`${coin.mint.slice(0, 4)}…${coin.mint.slice(-4)}`}
                />
              </div>

              {routeProblem && (
                <div className="rounded-xl border border-amber/20 bg-amber/10 p-3 text-sm leading-relaxed text-amber/90">
                  <div className="text-[11px] uppercase tracking-widest font-black text-amber">Trade route unavailable</div>
                  <p className="mt-1">
                    This token may not have enough live liquidity for that trade yet. Try a smaller amount, switch between SOL and AUDIO, or choose a more active token.
                  </p>
                </div>
              )}

              {side === "BUY" && (
                <label className="block rounded-xl border border-amber/20 bg-amber/10 p-3 text-sm leading-relaxed text-amber/90">
                  <span className="mb-2 block text-[11px] uppercase tracking-widest font-black text-amber">Investor Confirmation · {risk.label}</span>
                  <span className="block">This coin can move up or down. Liquidity may be limited, and royalty claims may still be unverified. Review the chart, pool depth, wallet cost, and royalty status before buying.</span>
                  <span className="mt-3 flex items-start gap-2">
                    <input type="checkbox" checked={riskAccepted} onChange={(e) => setRiskAccepted(e.target.checked)} className="mt-0.5" />
                    <span>I understand.</span>
                  </span>
                </label>
              )}

              <button
                className={`w-full py-4 rounded-xl text-sm font-bold tracking-widest uppercase transition-all ${
                  busy ? "opacity-60 cursor-not-allowed bg-white/[0.06] text-mute" :
                  paperMode ? "bg-violet text-white hover:bg-violet/90" :
                  side === "BUY" ? "bg-neon text-[#030303] hover:bg-[#00FC7D]" :
                  "bg-red text-pure-white hover:bg-[#FF4D79]"
                }`}
                disabled={!canSubmit}
                onClick={submit}
              >
                {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Signing…</span> :
                  quoteLoading ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Finding route…</span> :
                  paperMode ? `Paper ${side}` :
                  needsExternalWallet ? "Connect external wallet" :
                  address ? `Review ${side}` : "Connect to trade"}
              </button>
              {err && <div className="text-red text-[11px] uppercase tracking-widest text-center font-bold bg-red/5 border border-red/10 py-2 rounded-xl">{err}</div>}
              {ok && <div className="text-neon text-[11px] uppercase tracking-widest text-center font-bold bg-neon/5 border border-neon/10 py-2 rounded-xl">{ok}</div>}
              <p className="text-[11px] text-mute leading-relaxed text-center uppercase tracking-widest">
                {paperMode ? `Demo mode. No money moves and no blockchain transaction is sent. ${priceAgeText(fiatUpdatedAt)}.` : `Real Solana swap. ${priceAgeText(fiatUpdatedAt)}.`}
              </p>
              {artistSongsPanel}
              <WhyFansCanBuy compact />
              <div className="rounded-xl border border-edge bg-panel p-3">
                <div className="mb-3 flex items-start gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-edge bg-panel2">
                    <SafeImage src={coinArtwork} alt={coin.ticker} fill sizes="48px" fallback={coin.ticker} className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-widest font-black text-mute">What You Are Trading</div>
                    <div className="mt-1 text-sm font-black text-ink break-words">${coin.ticker} · {coin.name}</div>
                    <div className="mt-0.5 text-[11px] font-bold text-violet break-words">{coin.artist_name ?? "Unknown artist"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TradeInfo label="Song" value={selectedSong} />
                  <TradeInfo label="Price" value={formatDisplayFiat(coin.price ?? 0, 6)} />
                  <TradeInfo label="24h Move" value={`${change >= 0 ? "+" : ""}${fmtPct(change)}`} accent={change >= 0 ? "text-neon" : "text-red"} />
                  <TradeInfo label="Public Value" value={marketValueLabel} />
                  <TradeInfo label="Liquidity" value={formatDisplayFiat(coin.liquidity ?? 0, 0)} />
                  <TradeInfo label="Holders" value={fmtNum(coin.holder ?? 0)} />
                </div>
                <div className="mt-3 rounded-xl border border-edge bg-panel2/70 p-3 text-sm leading-relaxed text-mute">
                  <span className="font-black text-ink">{marketPulse}.</span> {fmtNum(coin.trade24h ?? 0)} trades today, {fmtNum(coin.uniqueWallet24h ?? 0)} active wallets, and {formatDisplayFiat(coin.v24hUSD ?? 0, 0)} in 24h volume. {royaltyStatus}.
                </div>
              </div>
              <div className="rounded-xl border border-neon/20 bg-neon/8 p-3">
                <div className="text-[11px] uppercase tracking-widest font-black text-neon">Trade in 4 steps</div>
                <div className="mt-2 grid gap-2 text-sm leading-relaxed text-mute sm:grid-cols-2">
                  <div><span className="font-black text-ink">1.</span> Enter {currency}/SOL amount</div>
                  <div><span className="font-black text-ink">2.</span> Review token estimate</div>
                  <div><span className="font-black text-ink">3.</span> Check fee and price movement</div>
                  <div><span className="font-black text-ink">4.</span> Confirm, then Portfolio updates</div>
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function OrderRow({ k, v, highlight }: { k: React.ReactNode; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs gap-3">
      <span className="text-mute uppercase tracking-widest text-[11px] font-bold">{k}</span>
      <span className={`font-mono text-right ${highlight ? "text-ink font-bold" : "text-mute"}`}>{v}</span>
    </div>
  );
}

function ChartStat({ k, v, tooltip }: { k: string; v: string; tooltip: string }) {
  return (
    <div className="rounded-xl bg-panel border border-edge p-3">
      <div className="label">
        <Glossary term={k} def={tooltip} category="financial">{k}</Glossary>
      </div>
      <div className="num text-sm mt-1 text-ink font-bold">{v}</div>
    </div>
  );
}

function TradeInfo({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-edge bg-panel2/70 p-2.5">
      <div className="text-[11px] uppercase tracking-widest text-mute font-black">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-black text-ink ${accent ?? ""}`} title={value}>{value}</div>
    </div>
  );
}
