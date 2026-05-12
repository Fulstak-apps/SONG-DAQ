"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Eye, Music2, RefreshCw, Wallet, Radio, ShieldCheck } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { useAudiusAudioBalance, useNativeBalance } from "@/components/WalletBalance";
import { WalletButton } from "@/components/WalletButton";
import { usePaperTrading, useSession, useUI } from "@/lib/store";
import { fmtNum } from "@/lib/pricing";
import { getSolPriceUsd } from "@/lib/balance";
import { readJson } from "@/lib/safeJson";
import { WalletDiagnostics } from "@/components/WalletDiagnostics";
import { formatCryptoWithFiat, formatFiat, priceAgeText } from "@/lib/fiat";

interface TokenRow {
  mint: string;
  amount: number;
  decimals: number;
  ticker: string;
  name: string;
  logo_uri: string | null;
  price: number | null;
  valueUsd: number | null;
  countedValueUsd?: number | null;
  issuerAllocation?: boolean;
  valuationNote?: string | null;
  isAudio: boolean;
  isArtistCoin: boolean;
  priceSource?: string | null;
  priceChange24h?: number | null;
  isVerified?: boolean;
  organicScoreLabel?: string | null;
  metadataSource?: string | null;
}

interface TokenHoldings {
  address: string;
  tokens: TokenRow[];
  totalUsd: number;
  audioBalance: number;
  artistCoinCount: number;
}

function fmtUsd(n: number) {
  return formatFiat(n, "USD");
}

function short(addr: string) {
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function countedUsd(t: TokenRow) {
  return t.countedValueUsd ?? t.valueUsd ?? 0;
}

function useTokenHoldings(address: string | null | undefined, mode: "summary" | "full" = "summary") {
  const [data, setData] = useState<TokenHoldings | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!address) { setData(null); return; }
    let alive = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      setLoading(true);
      try {
        const r = await fetch(`/api/wallet/tokens?address=${encodeURIComponent(address)}&mode=${mode}`, { cache: "no-store" });
        const j = await readJson<TokenHoldings>(r);
        if (alive && r.ok && j) setData(j);
      } catch {
        /* keep last good value */
      } finally {
        inFlight = false;
        if (alive) setLoading(false);
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
    const i = setInterval(load, mode === "full" ? 10_000 : 12_000);
    return () => {
      alive = false;
      clearInterval(i);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("songdaq:wallet-refresh", onRefresh);
    };
  }, [address, mode, nonce]);
  return { data, loading, refresh: () => setNonce((n) => n + 1) };
}

export default function PortfolioPage() {
  const { address, kind, provider, audius } = useSession();
  const { openLoginModal } = useUI();
  const paper = usePaperTrading();
  const { enabled: paperMode } = paper;
  const hasExternalWallet = !!address && provider !== "audius";
  const externalAddress = hasExternalWallet ? address : null;
  const portfolioWallet = externalAddress ?? audius?.wallets?.sol ?? null;
  const native = useNativeBalance(externalAddress, hasExternalWallet ? kind : null);
  const tradingTokens = useTokenHoldings(externalAddress, "full");
  const audiusTokens = useTokenHoldings(audius?.wallets?.sol, "full");
  const [portfolio, setPortfolio] = useState<any>(null);
  const [paperUsd, setPaperUsd] = useState({ sol: 0, audio: 0 });
  const [audioUsdPrice, setAudioUsdPrice] = useState(0);
  const [solUsdPrice, setSolUsdPrice] = useState(0);
  const [coinIndex, setCoinIndex] = useState<Record<string, any>>({});
  const liveAudiusAudioBalance = useAudiusAudioBalance(audius?.handle);

  useEffect(() => {
    if (!portfolioWallet) { setPortfolio(null); return; }
    let alive = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      const params = new URLSearchParams({ wallet: portfolioWallet });
      if (audius?.userId) params.set("audiusUserId", audius.userId);
      if (audius?.wallets?.sol) params.set("audiusSolWallet", audius.wallets.sol);
      if (audius?.wallets?.eth) params.set("audiusEthWallet", audius.wallets.eth);
      try {
        const r = await fetch(`/api/portfolio?${params.toString()}`, { cache: "no-store" });
        const j = await readJson(r);
        if (alive && r.ok) setPortfolio(j);
      } catch {
        /* keep last */
      } finally {
        inFlight = false;
      }
    };
    load();
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ address?: string | null }>).detail;
      if (!detail?.address || detail.address === portfolioWallet) load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("songdaq:wallet-refresh", onRefresh);
    const i = setInterval(load, 6_000);
    return () => {
      alive = false;
      clearInterval(i);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("songdaq:wallet-refresh", onRefresh);
    };
  }, [portfolioWallet, audius?.userId, audius?.wallets?.sol, audius?.wallets?.eth]);

  useEffect(() => {
    if (!paperMode) return;
    let alive = true;
    const load = async () => {
      try {
        const [solUsd, coinResp] = await Promise.allSettled([
          getSolPriceUsd(),
          fetch("/api/coins?limit=100", { cache: "no-store" }).then((r) => readJson<any>(r)),
        ]);
        if (!alive) return;
        const audio = coinResp.status === "fulfilled"
          ? Number((coinResp.value?.coins ?? []).find((c: any) => String(c.ticker).toUpperCase() === "AUDIO")?.price ?? 0)
          : 0;
        setPaperUsd({
          sol: solUsd.status === "fulfilled" ? Number(solUsd.value || 0) : 0,
          audio,
        });
      } catch {
        if (alive) setPaperUsd({ sol: 0, audio: 0 });
      }
    };
    load();
    const i = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(i); };
  }, [paperMode]);

  useEffect(() => {
    let alive = true;
    getSolPriceUsd()
      .then((price) => { if (alive) setSolUsdPrice(Number(price || 0)); })
      .catch(() => {});
    fetch("/api/coins?limit=100", { cache: "no-store" })
      .then((r) => readJson<any>(r))
      .then((j) => {
        if (!alive) return;
        const next: Record<string, any> = {};
        let audioPrice = 0;
        for (const c of j?.coins ?? []) {
          next[c.mint] = c;
          if (String(c.ticker).toUpperCase() === "AUDIO") audioPrice = Number(c.price ?? 0);
        }
        setCoinIndex(next);
        setAudioUsdPrice(audioPrice);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const artistTokens = useMemo(() => {
    const indexedHoldings: TokenRow[] = (portfolio?.coinHoldings ?? []).map((h: any) => {
      const coin = coinIndex[h.mint] ?? {};
      const amount = Number(h.amount ?? 0);
      const price = Number.isFinite(Number(coin.price)) ? Number(coin.price) : (amount > 0 ? Number(h.costBasis ?? 0) / amount : null);
      return {
        mint: h.mint,
        amount,
        decimals: Number(coin.decimals ?? 6),
        ticker: h.ticker || coin.ticker || h.mint.slice(0, 4),
        name: coin.name || h.ticker || "Artist Token",
        logo_uri: coin.logo_uri ?? null,
        price,
        valueUsd: price != null ? amount * price : Number(h.costBasis ?? 0),
        countedValueUsd: price != null ? amount * price : Number(h.costBasis ?? 0),
        issuerAllocation: false,
        isAudio: String(h.ticker || coin.ticker).toUpperCase() === "AUDIO",
        isArtistCoin: true,
      };
    });
    const all = [
      ...(tradingTokens.data?.tokens ?? []),
      ...(audiusTokens.data?.tokens ?? []),
      ...indexedHoldings,
    ];
    const seen = new Set<string>();
    return all.filter((t) => {
      if (!t.isArtistCoin || (t.amount ?? 0) <= 0 || seen.has(t.mint)) return false;
      seen.add(t.mint);
      return true;
    });
  }, [tradingTokens.data, audiusTokens.data, portfolio?.coinHoldings, coinIndex]);

  const otherWalletAssets = useMemo(() => {
    const artistMints = new Set(artistTokens.map((t) => t.mint));
    return (tradingTokens.data?.tokens ?? [])
      .filter((t) => (t.amount ?? 0) > 0 && !artistMints.has(t.mint))
      .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  }, [tradingTokens.data, artistTokens]);

  const songTokens = useMemo(() => {
    return (portfolio?.holdings ?? []).filter((h: any) => (h.amount ?? 0) > 0);
  }, [portfolio?.holdings]);

  const totalUsd = (native.usd ?? 0) + (tradingTokens.data?.totalUsd ?? 0) + (audiusTokens.data?.totalUsd ?? 0);
  const tradingAudioBalance = tradingTokens.data?.audioBalance ?? 0;
  const audiusProfileAudioBalance = Math.max(
    audiusTokens.data?.audioBalance ?? 0,
    typeof liveAudiusAudioBalance === "number" ? liveAudiusAudioBalance : 0,
    typeof audius?.audioBalance === "number" ? audius.audioBalance : 0,
  );
  const audioBalance = externalAddress && audius?.wallets?.sol && externalAddress === audius.wallets.sol
    ? Math.max(tradingAudioBalance, audiusProfileAudioBalance)
    : tradingAudioBalance + audiusProfileAudioBalance;
  const audioValueUsd = [
    ...(tradingTokens.data?.tokens ?? []),
    ...(audiusTokens.data?.tokens ?? []),
  ].filter((t) => t.isAudio).reduce((sum, t) => sum + countedUsd(t), 0) ||
    (audioBalance * audioUsdPrice);
  const cashUsd = paperMode
    ? paper.balances.cashUsd + (paper.balances.sol * paperUsd.sol) + (paper.balances.audio * paperUsd.audio)
    : 0;
  const paperSol = paperMode ? paper.balances.sol : 0;
  const paperAudio = paperMode ? paper.balances.audio : 0;
  const songValueSol = portfolio?.summary?.value ?? 0;
  const royaltySol = portfolio?.summary?.royalty ?? 0;
  const artistValueUsd = artistTokens.reduce((sum, t) => sum + countedUsd(t), 0);
  const issuerAllocationValueUsd = artistTokens.reduce((sum, t) => sum + (t.issuerAllocation ? (t.valueUsd ?? 0) : 0), 0);
  const otherWalletValueUsd = otherWalletAssets.reduce((sum, t) => sum + countedUsd(t), 0);
  const indexedAudioValueUsd = [
    ...(tradingTokens.data?.tokens ?? []),
    ...(audiusTokens.data?.tokens ?? []),
  ].filter((t) => t.isAudio).reduce((sum, t) => sum + countedUsd(t), 0);
  const indexedArtistValueUsd = [
    ...(tradingTokens.data?.tokens ?? []),
    ...(audiusTokens.data?.tokens ?? []),
  ].filter((t) => t.isArtistCoin).reduce((sum, t) => sum + countedUsd(t), 0);
  const audioValueTopUpUsd = Math.max(0, audioValueUsd - indexedAudioValueUsd);
  const artistValueTopUpUsd = Math.max(0, artistValueUsd - indexedArtistValueUsd);
  const songValueUsd = songValueSol * (solUsdPrice || (native.balance ? (native.usd ?? 0) / native.balance : 0));
  const royaltyUsd = royaltySol * (solUsdPrice || 0);
  const fiatUpdatedAt = native.updatedAt ?? null;
  const totalIndexedValueUsd = totalUsd + audioValueTopUpUsd + artistValueTopUpUsd + songValueUsd + cashUsd;
  const recentActivity = [
    ...(portfolio?.trades ?? []).map((t: any) => ({ ...t, kind: "Song", label: t.song?.symbol ?? "SONG", total: formatCryptoWithFiat(t.total, "SOL", Number(t.total ?? 0) * (solUsdPrice || 0)) })),
    ...(portfolio?.coinTrades ?? []).map((t: any) => ({ ...t, kind: "Artist", label: t.ticker ?? "TOKEN", total: fmtUsd(t.totalUsd ?? 0) })),
    ...(portfolio?.payouts ?? []).map((p: any) => ({ ...p, side: "ROYALTY", kind: "Royalty", label: p.song?.symbol ?? "SONG", total: formatCryptoWithFiat(p.amount, "SOL", Number(p.amount ?? 0) * (solUsdPrice || 0)) })),
  ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
  const pnl = (portfolio?.summary?.pnl ?? 0) + (tradingTokens.data?.totalUsd ?? 0) - (tradingTokens.data?.totalUsd ?? 0);
  const concentration = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (artistTokens.length ? 100 / Math.max(artistTokens.length, 1) : 100) +
        (songTokens.length ? 100 / Math.max(songTokens.length, 1) : 100) / 2,
      ),
    ),
  );

  if (!hasExternalWallet && paperMode) {
    const paperPositions = Object.values(paper.holdings);
    return (
      <div className="space-y-6 max-w-[1280px] mx-auto text-ink">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] font-black text-neon">Paper Trade / Demo Portfolio</div>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Practice Wallet</h1>
            <p className="text-mute text-sm mt-2">
              Demo mode gives you seeded fake balances so you can test buys, sells, and positions without connecting a live wallet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={paper.resetDemo} className="btn text-[10px] uppercase tracking-widest font-black">Reset Demo Balance</button>
            <button onClick={() => paper.setEnabled(false)} className="btn text-[10px] uppercase tracking-widest font-black">Exit Demo</button>
            <Link href="/market" className="btn text-[10px] uppercase tracking-widest font-black">Discover</Link>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <Metric label="Demo Cash" value={fmtUsd(cashUsd)} sub="Combined paper value from SOL + AUDIO + seed cash" />
          <Metric label="Demo SOL" value={formatCryptoWithFiat(paperSol, "SOL", paperUsd.sol ? paperSol * paperUsd.sol : null)} sub="Simulated wallet SOL" />
          <Metric label="Demo AUDIO" value={formatCryptoWithFiat(paperAudio, "AUDIO", paperUsd.audio ? paperAudio * paperUsd.audio : null)} sub="Simulated AUDIO balance" />
          <Metric label="Artist Coins" value={fmtNum(paperPositions.length)} sub="Paper holdings" />
          <Metric label="Song Coins" value="0" sub="Use the market to add positions" />
          <Metric label="PnL / Net Change" value="—" sub="Demo mode starts neutral" />
          <Metric label="Risk Focus" value="Demo" sub="No blockchain transaction is sent" />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
          <div className="panel-elevated p-5 grain">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">Paper Positions</h2>
                <p className="text-mute text-xs mt-1">Seeded positions update as you paper trade around the app.</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-neon font-black">Demo</span>
            </div>
            <div className="space-y-2">
              {paperPositions.length ? paperPositions.map((p) => (
                <div key={p.mint} className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-3">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-edge bg-panel2 shrink-0 grid place-items-center text-neon font-black text-xs">
                    {p.ticker.slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white truncate">{p.ticker}</div>
                    <div className="text-[10px] uppercase tracking-widest text-mute truncate">Paper holding</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm text-white">{fmtNum(p.amount ?? 0)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-mute">{fmtUsd(p.costUsd ?? 0)}</div>
                  </div>
                </div>
              )) : (
                <Empty icon={<Wallet size={18} />} title="No Paper Positions Yet" text="Open paper mode on the market and make a demo buy to populate this list." />
              )}
            </div>
          </div>

          <div className="panel-elevated p-5 grain">
            <div className="flex items-center gap-2 mb-4">
              <Radio size={16} className="text-violet" />
              <h2 className="text-lg font-black tracking-tight">Paper Trade History</h2>
            </div>
            <div className="space-y-2">
              {paper.trades.length ? paper.trades.slice(0, 8).map((t) => (
                <div key={t.id} className="rounded-xl border border-edge bg-white/[0.045] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{t.side} {t.ticker}</div>
                    <div className="text-[10px] uppercase tracking-widest text-mute truncate">{fmtUsd(t.totalUsd)} · {new Date(t.ts).toLocaleTimeString()}</div>
                  </div>
                  <div className={`text-[10px] uppercase tracking-widest font-black ${t.side === "BUY" ? "text-neon" : "text-red"}`}>{t.side}</div>
                </div>
              )) : (
                <Empty icon={<Music2 size={18} />} title="No Paper Trades Yet" text="Use the paper button in the header to trade without funds." />
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!hasExternalWallet && !audius) {
    return (
      <div className="max-w-[960px] mx-auto panel-elevated p-5 sm:p-10 text-center space-y-5 grain">
        <div className="w-14 h-14 rounded-2xl bg-neon/10 border border-neon/20 grid place-items-center mx-auto text-neon">
          <Wallet size={24} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink">Portfolio</h1>
          <p className="text-mute mt-2 text-sm">Browse the market freely. Connect only when you want wallet-specific balances or to trade.</p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button onClick={openLoginModal} className="btn-primary px-6 py-3 text-[10px] uppercase tracking-widest font-black">Connect Solana Wallet</button>
          <Link href="/market" className="btn px-6 py-3 text-[10px] uppercase tracking-widest font-black">Browse Market</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto text-ink">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] font-black text-neon">Real Wallet Portfolio</div>
          <h1 className="mt-2 text-4xl font-black tracking-tight">
            {audius?.handle ? `@${audius.handle}` : externalAddress ? short(externalAddress) : "Audius Profile"}
          </h1>
          <p className="text-mute text-sm mt-2">
            {externalAddress ? `External wallet ${short(externalAddress)}` : "External Solana wallet not connected"}
            {audius?.wallets?.sol ? ` · Audius vault ${short(audius.wallets.sol)}` : ""}
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-mute">
            Brokerage-style view: total value, SOL, AUDIO, Song Coins, Artist Coins, other wallet assets, profit/loss, and recent activity all roll into one indexed account view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { tradingTokens.refresh(); audiusTokens.refresh(); }}
            className="btn text-[10px] uppercase tracking-widest font-black"
          >
            <RefreshCw size={12} /> Refresh Wallet
          </button>
          {!externalAddress && <WalletButton compact connectOnly />}
          <Link href="/market" className="btn text-[10px] uppercase tracking-widest font-black">Discover</Link>
          {audius?.handle && (
            <a href={`https://audius.co/${audius.handle}`} target="_blank" rel="noreferrer" className="btn text-[10px] uppercase tracking-widest font-black">
              Audius <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <Metric label="Total Portfolio Value" value={fmtUsd(totalIndexedValueUsd)} sub={issuerAllocationValueUsd > 0 ? "Liquid value; issuer allocation separated" : paperMode ? "Paper cash + wallet + AUDIO + coins" : "SOL + AUDIO + Song Coins + Artist Coins + other assets"} />
        <Metric label="SOL" value={externalAddress && native.balance != null ? formatCryptoWithFiat(native.balance, "SOL", native.usd) : "Connect"} sub={externalAddress ? priceAgeText(fiatUpdatedAt) : "Connect external wallet"} />
        <Metric label="AUDIO" value={formatCryptoWithFiat(audioBalance, "AUDIO", audioValueUsd || null)} sub="Audius token value included in total" />
        <Metric label="Song Coins" value={fmtNum(songTokens.length)} sub={formatCryptoWithFiat(songValueSol, "SOL", songValueUsd)} />
        <Metric label="Artist Coins" value={fmtNum(artistTokens.length)} sub={issuerAllocationValueUsd > 0 ? `${fmtUsd(artistValueUsd)} liquid` : fmtUsd(artistValueUsd)} />
        <Metric label="Other Assets" value={fmtNum(otherWalletAssets.length)} sub={fmtUsd(otherWalletValueUsd)} />
        <Metric label="P/L" value={`${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}`} sub="Indexed portfolio delta" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Metric label="PnL / Net Change" value={`${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}`} sub="Indexed portfolio delta" />
        <Metric label="Concentration" value={`${concentration}%`} sub="Lower is broader" />
        <Metric label="Risk Focus" value={artistTokens.length || songTokens.length ? "Active" : "Idle"} sub="Review liquidity and trust badges" />
      </section>

        <WalletDiagnostics compact />

      {issuerAllocationValueUsd > 0 && (
        <div className="rounded-2xl border border-amber/25 bg-amber/10 p-4 text-amber">
          <div className="text-[10px] uppercase tracking-widest font-black">Issuer allocation is separated</div>
          <p className="mt-1 text-xs leading-relaxed text-amber/85">
            {fmtUsd(issuerAllocationValueUsd)} of creator-held coin supply is not counted in your liquid portfolio total. That supply is your own issued token inventory, not cash you can spend. Fans buy from the public pool/curve after liquidity is added.
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
        <div className="space-y-4">
        <div className="rounded-2xl border border-neon/20 bg-neon/8 p-4 text-neon">
          <div className="flex items-start gap-3">
            <Eye size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-black">Wallet visibility note</div>
              <p className="mt-1 text-xs leading-relaxed text-neon/85">
                Real trading uses your external Solana wallet. Your Audius vault is shown separately for identity and AUDIO visibility, but it cannot sign song-daq swaps yet. If Phantom hides a brand-new token as spam, open Phantom Hidden Tokens, mark it as Not Spam, then hit Refresh Wallet here.
              </p>
            </div>
          </div>
        </div>

        {portfolio?.databaseStatus === "unavailable" && (
          <div className="rounded-2xl border border-amber/25 bg-amber/10 p-4 text-amber">
            <div className="text-[10px] uppercase tracking-widest font-black">Portfolio index is reconnecting</div>
            <p className="mt-1 text-xs leading-relaxed text-amber/85">
              Your wallet balances still load directly from Solana. song-daq trade history and cost basis will refresh when the database connection is available.
            </p>
          </div>
        )}

        <div className="panel-elevated p-5 grain">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black tracking-tight">Artist Coins</h2>
              <p className="text-mute text-xs mt-1">Read from Solana token accounts, Audius artist-token metadata, and confirmed song-daq trade records.</p>
            </div>
            {(tradingTokens.loading || audiusTokens.loading) && <span className="text-[10px] uppercase tracking-widest text-neon animate-pulse">Syncing</span>}
          </div>
          <div className="space-y-2">
            {artistTokens.length ? artistTokens.map((t) => <TokenRow key={t.mint} t={t} />) : (
              <Empty icon={<Music2 size={18} />} title="No Artist Coins Found" text="Your connected Solana wallet, Audius vault, and confirmed song-daq trade records do not currently show Artist Coins." />
            )}
          </div>
        </div>

        <div className="panel-elevated p-5 grain">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black tracking-tight">External Wallet Assets</h2>
              <p className="text-mute text-xs mt-1">Everything visible in your connected Solana wallet, including meme coins and non-song-daq tokens. USD values use Jupiter prices when available.</p>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-neon font-black">{fmtUsd(otherWalletValueUsd)}</span>
          </div>
          <div className="space-y-2">
            {otherWalletAssets.length ? otherWalletAssets.map((t) => <WalletAssetRow key={t.mint} t={t} />) : (
              <Empty icon={<Wallet size={18} />} title="No Other Wallet Assets Found" text="Your connected external wallet does not currently show additional SPL tokens with a positive balance." />
            )}
          </div>
        </div>

        <div className="panel-elevated p-5 grain">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black tracking-tight">Song Coins</h2>
              <p className="text-mute text-xs mt-1">Indexed from song-daq song-coin positions and on-platform holdings.</p>
            </div>
          </div>
          <div className="space-y-2">
            {songTokens.length ? songTokens.map((h: any) => (
              <Link key={h.id} href={`/song/${h.songId}`} className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-3 hover:bg-panel2 hover:border-white/25 active:scale-[0.99] transition">
                <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-edge bg-panel2 shrink-0">
                  <SafeImage src={h.song?.artworkUrl ?? null} alt={h.song?.symbol ?? "SONG"} fill sizes="44px" fallback={h.song?.symbol ?? "S"} className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white truncate">{h.song?.symbol ?? "SONG"}</div>
                  <div className="text-[10px] uppercase tracking-widest text-mute truncate">{h.song?.title ?? "Song token"}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-white">{fmtNum(h.amount ?? 0)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-mute">{formatCryptoWithFiat((h.amount ?? 0) * (h.song?.price ?? 0), "SOL", ((h.amount ?? 0) * (h.song?.price ?? 0)) * (solUsdPrice || 0))}</div>
                </div>
              </Link>
            )) : (
              <Empty icon={<Music2 size={18} />} title="No Song Coins Found" text="Song-coin positions will appear here after you buy or receive them on song-daq." />
            )}
          </div>
        </div>
        </div>

        <div className="space-y-4">
          <div className="panel-elevated p-5 grain">
            <div className="flex items-center gap-2 mb-4">
              <Radio size={16} className="text-violet" />
              <h2 className="text-lg font-black tracking-tight">Audius Profile</h2>
            </div>
            {portfolio?.audiusWallet ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  {portfolio.audiusWallet.name || portfolio.audiusWallet.handle}
                  {portfolio.audiusWallet.verified && <ShieldCheck size={14} className="text-neon" />}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Mini label="Followers" value={fmtNum(portfolio.audiusWallet.followers ?? 0)} />
                  <Mini label="Tracks" value={fmtNum(portfolio.audiusWallet.trackCount ?? 0)} />
                  <Mini label="Plays" value={fmtNum(portfolio.audiusWallet.totalPlays ?? 0)} />
                </div>
              </div>
            ) : (
              <Empty icon={<Radio size={18} />} title="Audius Not Linked" text="Sign in with Audius to add your public artist vault and catalog stats." />
            )}
          </div>

          <div className="panel-elevated p-5 grain">
            <h2 className="text-lg font-black tracking-tight mb-4">Song Coin Index</h2>
            <div className="grid grid-cols-2 gap-2">
              <Mini label="Song Value" value={formatCryptoWithFiat(songValueSol, "SOL", songValueUsd)} />
              <Mini label="Royalty" value={formatCryptoWithFiat(royaltySol, "SOL", royaltyUsd)} />
            </div>
          </div>
        </div>
      </section>

      <section className="panel-elevated p-5 grain">
        <h2 className="text-xl font-black tracking-tight mb-4">Recent Activity</h2>
        {recentActivity.length ? (
          <div className="divide-y divide-white/[0.04]">
            {recentActivity.map((a: any) => (
              <div key={`${a.kind}-${a.id}`} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="text-sm font-bold">{a.side} {a.label}</div>
                  <div className="text-[10px] uppercase tracking-widest text-mute">{a.kind} · {new Date(a.createdAt).toLocaleString()}</div>
                </div>
                <div className="font-mono text-sm text-ink">{a.total}</div>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={<Wallet size={18} />} title="No Activity Yet" text="Confirmed transactions and royalty records will appear here." />
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel-elevated p-5 grain">
      <div className="text-[10px] uppercase tracking-widest text-mute font-black">{label}</div>
      <div className="mt-2 text-2xl font-mono font-black text-white">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-mute">{sub}</div>
    </div>
  );
}

function TokenRow({ t }: { t: TokenRow }) {
  const liquidValue = countedUsd(t);
  return (
    <Link href={`/coin/${t.mint}`} className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-3 hover:bg-panel2 hover:border-white/25 active:scale-[0.99] transition">
      <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-edge bg-panel2 shrink-0">
        <SafeImage src={t.logo_uri} alt={t.ticker} fill sizes="44px" fallback={t.ticker} className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="font-bold text-white truncate">${t.ticker}</div>
          {t.issuerAllocation ? <span className="shrink-0 rounded-full border border-amber/25 bg-amber/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber">Issuer</span> : null}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-mute truncate">{t.name}</div>
        {t.valuationNote ? <div className="mt-1 text-[10px] normal-case tracking-normal text-amber/80 line-clamp-2">{t.valuationNote}</div> : null}
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-white">{fmtNum(t.amount)}</div>
        <div className="text-[10px] uppercase tracking-widest text-mute">
          {t.issuerAllocation ? "Not counted" : liquidValue ? fmtUsd(liquidValue) : "No price"}
        </div>
        {t.issuerAllocation && t.valueUsd != null ? <div className="text-[9px] uppercase tracking-widest text-mute">{fmtUsd(t.valueUsd)} estimated</div> : null}
      </div>
    </Link>
  );
}

function WalletAssetRow({ t }: { t: TokenRow }) {
  const liquidValue = countedUsd(t);
  const body = (
    <>
      <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-edge bg-panel2 shrink-0">
        <SafeImage src={t.logo_uri} alt={t.ticker} fill sizes="44px" fallback={t.ticker} className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="font-bold text-white truncate">${t.ticker}</div>
          {t.isVerified ? <span className="shrink-0 rounded-full border border-neon/20 bg-neon/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-neon">Verified</span> : null}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-mute truncate">{t.name}</div>
        <div className="mt-1 font-mono text-[9px] text-mute truncate">{short(t.mint)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-sm text-white">{fmtNum(t.amount)}</div>
        <div className="text-[10px] uppercase tracking-widest text-mute">
          {t.issuerAllocation ? "Not counted" : liquidValue ? fmtUsd(liquidValue) : "No USD price"}
        </div>
      </div>
    </>
  );

  if (t.isArtistCoin) {
    return (
      <Link href={`/coin/${t.mint}`} className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-3 hover:bg-panel2 hover:border-white/25 active:scale-[0.99] transition">
        {body}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-3">
      {body}
      <a
        href={`https://solscan.io/token/${t.mint}`}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-lg border border-edge bg-panel2 p-2 text-mute hover:text-neon hover:border-neon/30 transition"
        title="Open token on Solscan"
      >
        <ArrowUpRight size={13} />
      </a>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[9px] uppercase tracking-widest text-mute font-black">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-edge bg-panel p-8 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-panel2 grid place-items-center text-mute">{icon}</div>
      <div className="text-sm font-bold text-ink">{title}</div>
      <div className="mt-1 text-xs text-mute max-w-md mx-auto">{text}</div>
    </div>
  );
}
