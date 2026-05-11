"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/lib/store";
import { api } from "@/lib/api";
import { fmtSol, fmtNum } from "@/lib/pricing";
import { spotPrice } from "@/lib/bondingCurve";
import { computePerformance } from "@/lib/pricing";
import {
  DEFAULT_ROYALTY,
  validateRoyalty,
  type RoyaltyConfig,
} from "@/lib/royaltyConfig";
import { RoyaltyConfigEditor } from "./RoyaltyConfigEditor";
import type { AudiusTrack } from "@/lib/audius";
import { createArtistPaidSongMint, getConnectedWalletId, sendSerializedTransaction, type WalletId } from "@/lib/wallet";
import { Glossary } from "@/components/Tooltip";
import { WalletButton } from "@/components/WalletButton";
import { LiveTradingStatusBanner } from "@/components/LiveTradingStatusBanner";
import { WalletDiagnostics } from "@/components/WalletDiagnostics";
import { WhyFansCanBuy } from "@/components/WhyFansCanBuy";
import { AlertTriangle, ChevronRight, ChevronLeft, Rocket, Music, Settings, BarChart3, ShieldCheck, CheckCircle2 } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type LaunchKind = "SONG" | "ARTIST";

export function CoinLauncher({ onLaunched }: { onLaunched?: () => void }) {
  const { address, kind, provider, audius } = useSession();
  const externalWalletAddress = kind === "solana" && provider && provider !== "audius" ? address : null;
  const externalWalletProvider = provider && provider !== "audius" ? provider : null;
  const [step, setStep] = useState<Step>(1);
  const [launchKind, setLaunchKind] = useState<LaunchKind>("SONG");

  // Step 1: track selection
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [pick, setPick] = useState<AudiusTrack | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [trackErr, setTrackErr] = useState<string | null>(null);

  // Step 2: tokenomics
  const [supply, setSupply] = useState(1_000_000_000);
  const [basePrice, setBasePrice] = useState(0.001);
  const [curveSlope, setCurveSlope] = useState(0.0000005);
  const [distributor, setDistributor] = useState<string>("");
  const [royalty, setRoyalty] = useState<RoyaltyConfig>(DEFAULT_ROYALTY);
  const [maxWalletBps, setMaxWalletBps] = useState(200);
  const [artistAllocationBps, setArtistAllocationBps] = useState(5000);
  const [liquidityTokenAmount, setLiquidityTokenAmount] = useState(500_000_000);
  const [liquidityPairAmount, setLiquidityPairAmount] = useState(1);
  const [liquidityPairAsset, setLiquidityPairAsset] = useState<"SOL" | "USDC">("SOL");
  const [liquidityLockDays, setLiquidityLockDays] = useState(180);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);

  // Step 4
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [liquidityStage, setLiquidityStage] = useState<"idle" | "preparing" | "signing" | "confirming" | "live" | "failed">("idle");
  const [liquidityMessage, setLiquidityMessage] = useState<string | null>(null);
  const [launchStatus, setLaunchStatus] = useState<{
    configured: boolean;
    readyForPublic?: boolean;
    missing?: string[];
    payerConfigured?: boolean;
    treasuryConfigured?: boolean;
    jupiterConfigured?: boolean;
    artistPaysLaunchFees?: boolean;
    phantomReviewRequired?: boolean;
    walletTransactionsEnabled?: boolean;
    treasuryWallet?: string;
    network: string;
    rpcUrl: string;
    databaseConfigured?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!audius?.handle) return;
    setLoadingTracks(true); setTrackErr(null);
    fetch(`/api/audius/search?q=${encodeURIComponent(audius.handle)}`)
      .then((r) => r.json())
      .then((j) => {
        const mine = (j.tracks || []).filter((t: any) => String(t.user?.id) === String(audius.userId));
        setTracks(mine);
      })
      .catch((e) => setTrackErr(e.message))
      .finally(() => setLoadingTracks(false));
  }, [audius?.userId, audius?.handle]);

  useEffect(() => {
    fetch("/api/launch/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setLaunchStatus(j))
      .catch(() => setLaunchStatus(null));
  }, []);

  const royaltyValid = validateRoyalty(royalty).ok;
  const canStep2 = launchKind === "ARTIST" ? true : !!pick;
  const canStep3 = canStep2 && royaltyValid && supply >= 1_000 && basePrice > 0 && curveSlope >= 0 && (launchKind === "ARTIST" || !!distributor);
  const liquidityValid = liquidityTokenAmount > 0 && liquidityPairAmount > 0 && liquidityLockDays >= 30;
  const allocationRisk = artistAllocationBps > 5000 || maxWalletBps > 1000;
  const walletTransactionsPaused = launchStatus?.walletTransactionsEnabled === false;
  const canLaunchReview = canStep3 && liquidityValid && !allocationRisk;
  const impliedPrice = liquidityPairAmount / Math.max(liquidityTokenAmount, 1);
  const launchLiquidityRatio = liquidityTokenAmount / Math.max(supply, 1);
  const projectedDepth = liquidityPairAmount >= 5 ? "Institutional" : liquidityPairAmount >= 1 ? "Healthy" : "Thin";
  const launchImpact = liquidityPairAmount > 0 ? Math.min(25, (1 / liquidityPairAmount) * 2.5) : 25;

  const previewSeries = useMemo(() => {
    const arr: { x: number; y: number }[] = [];
    const perf = pick
      ? computePerformance({
          streams: pick.play_count ?? 0,
          likes: pick.favorite_count ?? 0,
          reposts: pick.repost_count ?? 0,
          volume24h: 0,
          hoursSinceLaunch: 1,
        })
      : 1;
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const c = (supply * i) / steps;
      arr.push({
        x: c,
        y: spotPrice({ basePrice, slope: curveSlope, circulating: c, performance: perf }),
      });
    }
    return arr;
  }, [supply, basePrice, curveSlope, pick]);

  async function deploy() {
    if (!externalWalletAddress || !externalWalletProvider) {
      setErr("Connect Phantom, Solflare, or Backpack before launching. Audius verifies the artist, but an external Solana wallet must sign the mint.");
      return;
    }
    if (launchKind === "ARTIST") {
      setErr("Artist Coin launch must use the Open Audio/Audius artist-coin path: a $AUDIO-paired bonding curve, creator vesting, and reward pool. SONG·DAQ will not mint a fake artist coin until that launchpad integration is approved.");
      return;
    }
    if (!pick) return;
    if (launchStatus && !launchStatus.readyForPublic) {
      const missing = launchStatus.missing?.length ? launchStatus.missing.join(", ") : "Production launch configuration";
      setErr(`${missing} is required before this can reserve real launch liquidity on Solana.`);
      return;
    }
    if (walletTransactionsPaused) {
      setErr("Live wallet signing is paused while SONG·DAQ completes Phantom/Blowfish review. This prevents Phantom from showing the scary blocked-request screen. Use Paper Mode or launch locally/devnet until the live domain is approved.");
      return;
    }
    setBusy(true); setErr(null);
    setLiquidityStage("idle");
    setLiquidityMessage(null);
    try {
      if (audius) {
        const link = await fetch("/api/audius/link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: externalWalletAddress, walletType: "solana", profile: audius, role: "ARTIST" }),
        });
        if (!link.ok) {
          const j = await link.json().catch(() => ({}));
          console.warn("Could not persist Audius wallet link before launch", j.error);
        }
      }
      const treasuryWallet = launchStatus?.treasuryWallet || process.env.NEXT_PUBLIC_TREASURY_WALLET;
      if (!treasuryWallet) throw new Error("TREASURY_WALLET is required before launch.");
      const artistSupply = Math.max(0, Number(supply));
      const cleanTitle = String(pick.title ?? "Song Token").replace(/\s+/g, " ").trim();
      const cleanSymbol = cleanTitle.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase() || "SONG";
      const metadataBaseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const paidMint = await createArtistPaidSongMint(externalWalletProvider as WalletId, {
        artistWallet: externalWalletAddress,
        treasuryWallet,
        artistSupply,
        treasurySupply: Number(liquidityTokenAmount),
        metadata: {
          name: `${cleanTitle} Song Token`.slice(0, 32),
          symbol: cleanSymbol,
          baseUrl: metadataBaseUrl,
        },
      });
      const r = await api<any>("/api/songs", {
        method: "POST",
        json: {
          audiusTrackId: pick.id,
          artistWallet: externalWalletAddress,
          walletType: "solana",
          supply,
          basePrice,
          curveSlope,
          distributor,
          royalty,
          maxWalletBps,
          artistAllocationBps,
          ownershipConfirmed,
          riskAcknowledged,
          liquidity: {
            tokenAmount: liquidityTokenAmount,
            pairAmount: liquidityPairAmount,
            pairAsset: liquidityPairAsset,
            lockDays: liquidityLockDays,
          },
          clientMint: paidMint,
        },
      });
      setResult(r);
      setLiquidityStage("preparing");
      setLiquidityMessage("Coin minted. Preparing the required launch liquidity transaction now.");

      try {
        const prep = await api<{
          transaction: string;
          poolId: string;
          lpMint: string;
          mintA: string;
          mintB: string;
          configId: string;
        }>(`/api/songs/${r.song.id}/liquidity/onchain`, {
          method: "POST",
          json: {
            wallet: externalWalletAddress,
            tokenAmount: Number(liquidityTokenAmount),
            pairAmount: Number(liquidityPairAmount),
            pairAsset: liquidityPairAsset,
            lockDays: Number(liquidityLockDays),
          },
        });

        const walletId = getConnectedWalletId() || externalWalletProvider;
        setLiquidityStage("signing");
        setLiquidityMessage("Approve the second Phantom transaction to add the reserved coins and paired SOL/USDC into the launch pool.");
        const liquidityTxSig = await sendSerializedTransaction(walletId as WalletId, prep.transaction);

        setLiquidityStage("confirming");
        setLiquidityMessage("Liquidity transaction sent. Verifying the pool before opening trading to fans.");
        let live: any = null;
        let lastLiquidityError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            live = await api<any>(`/api/songs/${r.song.id}/liquidity`, {
              method: "POST",
              json: {
                wallet: externalWalletAddress,
                tokenAmount: Number(liquidityTokenAmount),
                pairAmount: Number(liquidityPairAmount),
                pairAsset: liquidityPairAsset,
                lockDays: Number(liquidityLockDays),
                liquidityTxSig,
                poolId: prep.poolId,
                lpMint: prep.lpMint,
              },
            });
            break;
          } catch (recordError: any) {
            lastLiquidityError = recordError;
            await new Promise((resolve) => setTimeout(resolve, 1600 + attempt * 1600));
          }
        }
        if (!live) throw lastLiquidityError || new Error("Liquidity transaction was sent, but SONG·DAQ could not verify it yet.");

        setLiquidityStage("live");
        setLiquidityMessage("Launch liquidity is verified. Fans can now buy and sell this coin.");
        setResult({ ...r, song: live.song || r.song, launch: { ...r.launch, liquidityTxSig, poolId: prep.poolId, lpMint: prep.lpMint, tradingStatus: "LIVE" } });
      } catch (liquidityError: any) {
        setLiquidityStage("failed");
        setLiquidityMessage(liquidityError?.message || "Coin minted, but automatic liquidity setup did not finish. Open the token detail page and use Add Liquidity to make it live.");
      }
      onLaunched?.();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!audius) {
    return (
      <div className="panel p-5 sm:p-10 text-center text-mute uppercase tracking-widest font-bold text-xs bg-panel2 border-dashed border-edge">
        Sign in with Audius to verify your artist identity before launching a song token.
      </div>
    );
  }

  if (!externalWalletAddress) {
    return (
      <div className="panel p-5 sm:p-10 text-center space-y-5 bg-panel2 border-dashed border-edge">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neon/25 bg-neon/10 text-neon">
          <Rocket size={22} />
        </div>
        <div>
          <div className="text-ink text-lg font-black tracking-tight">External wallet required to launch</div>
          <p className="mt-2 text-sm text-mute leading-relaxed max-w-xl mx-auto">
            Audius verifies that @{audius.handle} is the artist. Phantom, Solflare, or Backpack must sign the mint and pay the Solana launch fees.
          </p>
        </div>
        <div className="flex justify-center">
          <WalletButton connectOnly />
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 relative overflow-hidden shadow-2xl border border-edge bg-panel2 backdrop-blur-xl">
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet/5 rounded-full blur-[100px] pointer-events-none" />
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 relative z-10">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center border border-neon/20">
              <Rocket className="text-neon" size={20} />
            </div>
            Artist token launch
          </h2>
          <div className="text-[10px] uppercase tracking-widest font-bold text-mute">
            Authenticated Issuer: <span className="text-white">@{audius.handle}</span>
          </div>
        </div>
        <Stepper step={step} />
      </header>

      <div className="relative z-10 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 rounded-2xl border border-edge bg-panel p-1">
        <button
          type="button"
          onClick={() => { setLaunchKind("SONG"); setStep(1); setErr(null); }}
          className={`rounded-xl px-4 py-3 text-[10px] uppercase tracking-widest font-black transition ${launchKind === "SONG" ? "bg-neon/15 text-neon border border-neon/25" : "text-mute hover:text-ink"}`}
        >
          Song Token
        </button>
        <button
          type="button"
          onClick={() => { setLaunchKind("ARTIST"); setStep(1); setErr(null); }}
          className={`rounded-xl px-4 py-3 text-[10px] uppercase tracking-widest font-black transition ${launchKind === "ARTIST" ? "bg-violet/15 text-violet border border-violet/25" : "text-mute hover:text-ink"}`}
        >
          Artist Token
        </button>
      </div>

      {launchStatus && !launchStatus.readyForPublic && (
        <div className="relative z-10 rounded-xl border border-amber/25 bg-amber/10 px-4 py-3 text-amber flex items-start gap-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-black">Production launch configuration required</div>
            <div className="mt-1 text-xs leading-relaxed text-amber/80">
              Set {launchStatus.missing?.join(", ") || "the required production env vars"} in Render, then redeploy. Artists pay mint and launch network fees from their connected Solana wallet.
            </div>
            {launchStatus.missing?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {launchStatus.missing.map((m) => (
                  <span key={m} className="rounded-full border border-amber/20 bg-amber/10 px-2 py-0.5 text-[9px] uppercase tracking-widest font-black text-amber">
                    {m}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {launchStatus?.readyForPublic && (
        <div className="relative z-10 rounded-xl border border-neon/25 bg-neon/10 px-4 py-3 text-neon flex items-start gap-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-black">Public launch ready</div>
            <div className="mt-1 text-xs leading-relaxed text-neon/80">
              Production env vars, Solana network, database, and treasury config are in place for live launch testing.
            </div>
          </div>
        </div>
      )}

      {walletTransactionsPaused && (
        <div className="relative z-10 rounded-xl border border-red/25 bg-red/10 px-4 py-3 text-red flex items-start gap-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-black">Live wallet signing paused</div>
            <div className="mt-1 text-xs leading-relaxed text-red/80">
              Phantom is blocking the live domain until SONG·DAQ passes Phantom/Blowfish review. We stop live launch signing here so users do not see a malicious-request wallet screen.
            </div>
          </div>
        </div>
      )}

      <LiveTradingStatusBanner compact />
      <LaunchReadinessChecklist
        walletConnected={!!externalWalletAddress}
        artistVerified={!!audius?.userId}
        metadataReady={!!(process.env.NEXT_PUBLIC_APP_URL || typeof window !== "undefined")}
        liquidityReady={liquidityValid}
        phantomReady={!walletTransactionsPaused}
        tokenTrustReady={!allocationRisk && ownershipConfirmed && riskAcknowledged}
      />
      <WhyFansCanBuy compact />

      <div className="relative z-10 min-h-[360px] sm:min-h-[460px]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.section
              key="s1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-mute">
                <Music size={14} className="text-violet" /> Step 01 — {launchKind === "ARTIST" ? "Artist Profile" : "Asset Selection"}
              </div>

              {launchKind === "ARTIST" && (
                <div className="grid gap-4 md:grid-cols-[120px_1fr] rounded-2xl border border-edge bg-panel p-5">
                  <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-edge bg-panel2">
                    {audius.avatar ? <Image src={audius.avatar} alt={audius.handle} fill sizes="112px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest font-black text-mute">Audius Artist Profile</div>
                      <div className="mt-1 text-2xl font-black text-ink truncate">{audius.name || audius.handle}</div>
                      <div className="text-xs text-mute">@{audius.handle}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] uppercase tracking-widest font-bold">
                      <div className="rounded-xl border border-edge bg-panel2 p-3 text-mute">External wallet <span className="block font-mono text-ink normal-case tracking-normal truncate">{externalWalletAddress.slice(0, 6)}…{externalWalletAddress.slice(-4)}</span></div>
                      <div className="rounded-xl border border-edge bg-panel2 p-3 text-mute">Audio <span className="block text-amber">Unavailable until song attached</span></div>
                    </div>
                  </div>
                </div>
              )}
              
              {launchKind === "SONG" && loadingTracks && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
                  <div className="text-[10px] uppercase tracking-widest font-bold text-mute">Scanning Audius Catalog...</div>
                </div>
              )}
              
              {launchKind === "SONG" && trackErr && <div className="panel p-4 bg-red/10 border-red/20 text-red text-xs font-bold uppercase tracking-widest text-center">{trackErr}</div>}
              
              {launchKind === "SONG" && !loadingTracks && !tracks.length && (
                <div className="panel p-12 text-center space-y-4 bg-panel border-dashed border-edge">
                  <div className="text-mute text-sm font-medium leading-relaxed">
                    No compatible master recordings found for @{audius.handle}.
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-mute">
                    Upload a track to Audius first, then initialize terminal.
                  </div>
                </div>
              )}

              {launchKind === "SONG" && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] sm:max-h-[400px] overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                {tracks.map((t) => {
                  const art = t.artwork?.["480x480"] || t.artwork?.["150x150"];
                  const selected = pick?.id === t.id;
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setPick(t)}
                      className={`text-left panel p-4 flex gap-4 transition-all relative overflow-hidden group active:scale-[0.99] ${selected ? "border-neon bg-neon/5 shadow-[0_0_20px_rgba(0,229,114,0.15)]" : "border-edge hover:border-white/25 bg-panel"}`}
                    >
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-edge bg-panel2 shrink-0 shadow-lg">
                        {art ? <Image src={art} alt={t.title} fill sizes="64px" className="object-cover group-hover:scale-110 transition-transform duration-500" /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white truncate group-hover:text-neon transition">{t.title}</div>
                        <div className="mt-2 flex items-center gap-3 text-[10px] font-mono font-bold text-mute">
                          <span>▶ {fmtNum(t.play_count ?? 0)}</span>
                          <span>♥ {fmtNum(t.favorite_count ?? 0)}</span>
                          <span>↺ {fmtNum(t.repost_count ?? 0)}</span>
                        </div>
                      </div>
                      {selected && <div className="absolute top-2 right-2"><CheckCircle2 className="text-neon" size={16} /></div>}
                    </button>
                  );
                })}
              </div>}
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="s2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-mute">
                  <Settings size={14} className="text-violet" /> Step 02 — Calibration
                </div>
                <div className="space-y-4">
                  <Field label="Total Issuance" value={supply} onChange={setSupply} step={1000} min={1000} unit="Tokens" />
                  <Field label="Initial Curve Price" value={basePrice} onChange={setBasePrice} step={0.0001} min={0} unit="SOL" />
                  <Field label="Curve Momentum" value={curveSlope} onChange={setCurveSlope} step={0.0000001} min={0} unit="Slope" />
                  <Field label="Max Wallet Cap" value={maxWalletBps / 100} onChange={(n) => setMaxWalletBps(Math.round(n * 100))} step={0.25} min={0.1} unit="% of supply" />
                  <Field label="Artist Vesting Allocation" value={artistAllocationBps / 100} onChange={(n) => setArtistAllocationBps(Math.round(n * 100))} step={0.25} min={0} unit="% of supply" />
                  {allocationRisk && (
                    <div className="rounded-xl border border-amber/20 bg-amber/10 p-3 text-xs text-amber">
                      This does not match the Audius-style model. Keep artist vesting at or below 50% and max wallet cap at or below 10%.
                    </div>
                  )}
                  <div className="rounded-xl border border-violet/20 bg-violet/10 p-3 text-xs leading-relaxed text-violet/85">
                    Audius-style artist coins use a 1B supply, public bonding-curve market, and creator vesting. Fans buy from the curve/pool, not from a hidden artist wallet.
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-mute px-1">Settlement Distributor</label>
                    <select
                      className="w-full bg-panel border border-edge rounded-xl px-4 py-3 text-sm text-ink focus:border-neon focus:ring-1 focus:ring-neon transition-all outline-none appearance-none cursor-pointer"
                      value={distributor}
                      onChange={(e) => setDistributor(e.target.value)}
                    >
                      <option value="" disabled>Choose Distributor...</option>
                      <option value="DistroKid">DistroKid</option>
                      <option value="TuneCore">TuneCore</option>
                      <option value="UnitedMasters">UnitedMasters</option>
                      <option value="CD Baby">CD Baby</option>
                      <option value="Other">Other distributor</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-mute">
                  <ShieldCheck size={14} className="text-neon" /> Royalty Distribution Model
                </div>
                <div className="panel p-6 bg-panel border-edge rounded-2xl">
                  <RoyaltyConfigEditor value={royalty} onChange={setRoyalty} />
                </div>
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="s3"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-mute">
                  <BarChart3 size={14} className="text-violet" /> Step 03 — Curve Preview
                </div>
                <div className="panel p-6 bg-panel border-edge rounded-2xl space-y-4">
                  <PreviewCurve series={previewSeries} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-widest font-bold text-mute">Launch Price</div>
                      <div className="font-mono text-sm font-bold text-white">{fmtSol(previewSeries[0]?.y ?? 0, 6)} SOL</div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="text-[9px] uppercase tracking-widest font-bold text-mute">Launch price</div>
                      <div className="font-mono text-sm font-bold text-neon">{fmtSol(previewSeries[previewSeries.length - 1]?.y ?? 0, 6)} SOL</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-mute">
                  Verification Manifest
                </div>
                <div className="panel p-6 bg-panel border-edge rounded-2xl space-y-3">
                  <Row k="Asset Reference" v={pick?.title ?? "—"} />
                  <Row k="Protocol ID" v={`$${(pick?.title ?? "SONG").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`} />
                  <Row k="Settlement Gateway" v={distributor} />
                  <Row k="Total Supply" v={fmtNum(supply)} />
                  <Row k="Issuance Yield" v={`${(royalty.holderShareBps/100).toFixed(0)}% to Holders`} color="text-neon" />
                  <Row k="Artist Vesting" v="50% target over 5 years" />
                  <div className="pt-3 border-t border-edge flex flex-wrap gap-2">
                    {royalty.streamingEnabled && <Tag label="Streaming Active" />}
                    {royalty.tradingFeesEnabled && <Tag label="Trading Fees Active" />}
                    {royalty.externalRevenueEnabled && <Tag label="External Sync Active" />}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {step === 4 && (
            <motion.section
              key="s4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-mute">
                <ShieldCheck size={14} className="text-neon" /> Step 04 — Add Liquidity Required
              </div>
              <div className="rounded-2xl border border-neon/20 bg-neon/8 p-5 text-neon">
                <div className="text-[10px] uppercase tracking-widest font-black">Liquidity opens the coin for fans</div>
                <p className="mt-2 text-sm leading-relaxed text-neon/85">
                  Fans need a live market to buy. In the Audius-style model, the public allocation sits in a $AUDIO-paired bonding curve/pool while the artist allocation vests separately. This MVP uses explicit launch liquidity and blocks trading until that pool is verified.
                </p>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="Token amount reserved for liquidity" value={liquidityTokenAmount} onChange={setLiquidityTokenAmount} step={1000} min={1} unit="Tokens" />
                <Field label={`Paired asset amount (${liquidityPairAsset})`} value={liquidityPairAmount} onChange={setLiquidityPairAmount} step={0.1} min={0.01} unit={liquidityPairAsset} />
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-mute px-1">Paired Asset</label>
                  <select value={liquidityPairAsset} onChange={(e) => setLiquidityPairAsset(e.target.value as any)} className="w-full bg-panel border border-edge rounded-xl px-4 py-3 text-sm text-ink">
                    <option value="SOL">SOL</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
                <Field label="Liquidity Lockup" value={liquidityLockDays} onChange={setLiquidityLockDays} step={30} min={30} unit="Days" />
              </div>
              <div className="panel p-5 bg-panel border-edge rounded-2xl space-y-3">
                <Row k="Initial implied price" v={`${impliedPrice.toFixed(8)} ${liquidityPairAsset}`} color="text-neon" />
                <Row k="Slippage estimate" v={liquidityPairAmount >= 1 ? "Low/Medium" : "High"} color={liquidityPairAmount >= 1 ? "text-neon" : "text-amber"} />
                <Row k="Liquidity source" v="Public curve / explicit pool approval" />
                <Row k="Lock status" v={`${liquidityLockDays} days required`} color="text-neon" />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <LaunchMetric k="Pool depth" v={projectedDepth} />
                <LaunchMetric k="Reserve target" v={`${(launchLiquidityRatio * 100).toFixed(1)}%`} />
                <LaunchMetric k="1 SOL impact" v={`${launchImpact.toFixed(2)}%`} tone={launchImpact > 5 ? "amber" : "neon"} />
                <LaunchMetric k="Wallet cap" v={`${(maxWalletBps / 100).toFixed(2)}%`} />
              </div>
              {!liquidityValid && (
                <div className="rounded-xl border border-red/20 bg-red/10 p-4 text-sm text-red">
                  Liquidity is required before launch. This protects buyers and allows trading to start fairly.
                </div>
              )}
            </motion.section>
          )}

          {step === 5 && (
            <motion.section
              key="s5"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 space-y-8"
            >
              {!result && !busy && (
                <div className="w-full max-w-3xl space-y-6">
                  <div className="w-20 h-20 rounded-3xl bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,229,114,0.2)]">
                    <Rocket className="text-neon" size={40} />
                  </div>
                  <div className="space-y-2 text-center">
                    <h3 className="text-2xl font-black tracking-tighter text-white uppercase">Review Risk + Launch</h3>
                    <p className="text-mute text-sm font-medium">
                      Your connected artist wallet signs a clear launch flow. The coin is not tradable until the public curve/pool has verified liquidity, so fans can buy from the market instead of from the artist directly.
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="panel p-4 text-left space-y-2 bg-panel border-edge">
                      <div className="text-[10px] uppercase tracking-widest font-black text-white">Launch summary</div>
                      <Row k="Song" v={pick?.title ?? "Artist coin"} />
                      <Row k="Supply" v={fmtNum(supply)} />
                      <Row k="Liquidity" v={`${fmtNum(liquidityTokenAmount)} tokens + ${liquidityPairAmount} ${liquidityPairAsset}`} color="text-neon" />
                      <Row k="Trading opens" v="After liquidity transaction verifies" color="text-neon" />
                      <Row k="Liquidity lock" v={`${liquidityLockDays} days`} />
                      <Row k="Artist allocation" v={`${(artistAllocationBps / 100).toFixed(2)}%`} />
                      <Row k="Max wallet cap" v={`${(maxWalletBps / 100).toFixed(2)}%`} />
                      <Row k="Royalty status" v="Pending verification" color="text-amber" />
                      <Row k="Signing policy" v="Wallet transaction only. No private key. No blind message." color="text-neon" />
                    </div>
                    <div className="panel p-4 text-left space-y-3 bg-panel border-edge">
                      <div className="text-[10px] uppercase tracking-widest font-black text-white">Wallet approval preview</div>
                      <div className="space-y-3 text-xs leading-relaxed text-mute">
                        <div>
                          <span className="font-black text-neon">Approval 1:</span> creates the SPL mint, attaches SONG·DAQ metadata, mints the fixed supply to your connected artist wallet, disables freeze authority, and revokes mint authority.
                        </div>
                        <div>
                          <span className="font-black text-neon">Approval 2:</span> creates the public liquidity pool with the token amount and {liquidityPairAsset} amount shown here.
                        </div>
                        <div>
                          Wallet prompts should show your wallet as signer, this token symbol, normal Solana programs, and no unlimited approval.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-xl border border-neon/20 bg-neon/10 p-4 text-left text-xs leading-relaxed text-neon/85">
                      <div className="mb-2 text-[10px] uppercase tracking-widest font-black text-neon">Clean launch rules</div>
                      <ul className="list-disc space-y-1 pl-4">
                        <li>Fixed supply is created once.</li>
                        <li>Freeze authority is disabled.</li>
                        <li>Mint authority is revoked in the same mint transaction.</li>
                        <li>Metadata includes the song, artist, image, royalty status, and liquidity status.</li>
                      </ul>
                    </div>
                    <div className="rounded-xl border border-amber/20 bg-amber/10 p-4 text-left text-xs leading-relaxed text-amber/90">
                      <div className="mb-2 text-[10px] uppercase tracking-widest font-black text-amber">Do not sign if you see</div>
                      <ul className="list-disc space-y-1 pl-4">
                        <li>A seed phrase, private key, or password request.</li>
                        <li>A message signature pretending to launch or trade.</li>
                        <li>A different domain, token, wallet, or amount than this preview.</li>
                        <li>An unlimited approval or unknown wallet drain warning.</li>
                      </ul>
                    </div>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-edge bg-panel p-3 text-left text-xs text-mute">
                    <input type="checkbox" checked={ownershipConfirmed} onChange={(e) => setOwnershipConfirmed(e.target.checked)} className="mt-1" />
                    <span>I confirm I own or control the rights needed to create this song token and I am not impersonating another artist.</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-edge bg-panel p-3 text-left text-xs text-mute">
                    <input type="checkbox" checked={riskAcknowledged} onChange={(e) => setRiskAcknowledged(e.target.checked)} className="mt-1" />
                    <span>I understand that fans can potentially profit only if demand pushes the coin price higher, but profit is not guaranteed and prices can go down.</span>
                  </label>
                  <div className="rounded-xl border border-neon/20 bg-neon/10 p-3 text-left text-xs leading-relaxed text-neon/85">
                    Audius-style launches use a public market curve plus artist vesting. SONG·DAQ will only enable live trading once liquidity is verified and Phantom/domain review is clear.
                  </div>
                  <button
                    type="button"
                    className="btn-primary w-full py-4 text-sm font-black tracking-widest shadow-[0_0_30px_rgba(0,229,114,0.3)] disabled:opacity-50 disabled:grayscale"
                    onClick={deploy}
                    disabled={launchStatus?.configured === false || walletTransactionsPaused || !canLaunchReview || !ownershipConfirmed || !riskAcknowledged}
                  >
                    {walletTransactionsPaused ? "PHANTOM REVIEW REQUIRED" : "SIGN MINT + ADD LIQUIDITY"}
                  </button>
                </div>
              )}
              
              {busy && (
                <div className="text-center space-y-6">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-edge rounded-full" />
                    <div className="absolute inset-0 border-4 border-neon border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-neon text-lg font-black tracking-tighter uppercase animate-pulse">
                      {liquidityStage === "idle" ? "Synchronizing Ledger…" : "Setting Up Liquidity…"}
                    </div>
                    <div className="max-w-md text-mute text-[10px] uppercase tracking-widest font-bold leading-relaxed">
                      {liquidityMessage || "Waiting for artist wallet signature · verifying Solana mint"}
                    </div>
                  </div>
                </div>
              )}
              
              {err && <div className="panel p-4 bg-red/10 border-red/20 text-red text-xs font-bold uppercase tracking-widest text-center max-w-md">{err}</div>}
              
              {result && (
                <div className="text-center space-y-6 max-w-md">
                  <div className="w-20 h-20 rounded-3xl bg-neon/20 border border-neon/50 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(0,229,114,0.4)]">
                    <CheckCircle2 className="text-neon" size={40} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black tracking-tighter text-white uppercase">Asset Verified</h3>
                    <div className="text-mute text-sm font-medium">Successfully minted {result.song?.symbol} on Solana.</div>
                    <div className="text-mute font-mono text-[10px] break-all">{result.song?.mintAddress}</div>
                    {result.launch?.metadataUri && (
                      <div className="text-mute font-mono text-[10px] break-all">Metadata: {result.launch.metadataUri}</div>
                    )}
                    {result.launch?.mintTx && (
                      <div className="text-neon font-mono text-[10px] break-all">Mint tx: {result.launch.mintTx}</div>
                    )}
                    <div className="rounded-xl border border-neon/20 bg-neon/10 p-3 text-xs leading-relaxed text-neon">
                      Wallet visibility metadata is attached on-chain. If Phantom still hides a brand-new token, open Hidden Tokens and mark it as Not Spam; the token is still in the wallet.
                    </div>
                    <div className={`rounded-xl border p-3 text-xs leading-relaxed ${
                      liquidityStage === "live"
                        ? "border-neon/20 bg-neon/10 text-neon"
                        : liquidityStage === "failed"
                          ? "border-amber/20 bg-amber/10 text-amber"
                          : "border-violet/20 bg-violet/10 text-violet"
                    }`}>
                      <div className="mb-1 text-[10px] uppercase tracking-widest font-black">
                        {liquidityStage === "live" ? "Liquidity live" : liquidityStage === "failed" ? "Liquidity still needed" : "Liquidity setup running"}
                      </div>
                      {liquidityMessage || "SONG·DAQ is preparing the launch liquidity step."}
                    </div>
                    <div className="rounded-xl border border-edge bg-panel p-3 text-left text-xs leading-relaxed text-mute">
                      Fans buy from the liquidity pool, not from a hidden mint. The artist receives the full supply first, then the reserved portion is moved into the public trading pool with paired SOL/USDC.
                    </div>
                  </div>
                  <a className="btn-primary block w-full py-4 text-sm font-black tracking-widest" href={`/song/${result.song?.id}`}>
                    {liquidityStage === "live" ? "OPEN LIVE TOKEN" : "OPEN TOKEN DETAIL"}
                  </a>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <WalletDiagnostics compact />

      <footer className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 sm:pt-8 border-t border-edge relative z-10">
        <button
          type="button"
          className={`flex w-full sm:w-auto items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold transition-all ${step === 1 ? "opacity-0 pointer-events-none" : "text-mute hover:text-ink"}`}
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1}
        >
          <ChevronLeft size={14} /> Previous Step
        </button>
        <button
          type="button"
          className="flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-panel border border-edge text-[10px] uppercase tracking-widest font-bold text-ink hover:bg-panel2 hover:border-neon/50 hover:text-neon active:scale-[0.99] transition-all disabled:opacity-30 disabled:grayscale"
          onClick={() => setStep((s) => Math.min(5, s + 1) as Step)}
          disabled={(step === 1 && !canStep2) || (step === 2 && !canStep3) || (step === 4 && !liquidityValid) || (step === 5 && !canLaunchReview)}
        >
          {step === 4 ? "Review Risk" : "Continue"} <ChevronRight size={14} />
        </button>
      </footer>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Source", "Configure", "Royalty", "Liquidity", "Launch"];
  return (
    <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:gap-4 sm:pb-0 no-scrollbar">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done = step > idx;
        return (
          <div key={label} className="flex shrink-0 items-center gap-2 sm:gap-4 group">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-[10px] font-black transition-all ${done ? "bg-neon/20 border-neon/50 text-neon shadow-[0_0_10px_rgba(0,229,114,0.2)]" : active ? "bg-neon text-black border-neon shadow-[0_0_15px_rgba(0,229,114,0.25)]" : "bg-panel border-edge text-mute"}`}>
                {idx}
              </div>
            </div>
            {idx < steps.length && <div className={`w-5 sm:w-8 h-px transition-all ${done ? "bg-neon/50" : "bg-white/10"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label, value, onChange, step, min, unit
}: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; unit: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase tracking-widest font-bold text-mute px-1 flex justify-between">
        <span>{label}</span>
        <span className="text-mute font-mono">{unit}</span>
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-panel border border-edge rounded-xl px-4 py-3 text-lg font-mono text-ink focus:border-neon focus:ring-1 focus:ring-neon transition-all outline-none"
      />
    </div>
  );
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-edge last:border-0">
      <span className="text-[10px] uppercase tracking-widest font-bold text-mute">{k}</span>
      <span className={`font-mono text-xs font-bold ${color || "text-white"}`}>{v}</span>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="text-[8px] uppercase tracking-widest font-black px-2 py-1 rounded bg-panel2 text-mute border border-edge">{label}</span>;
}

function LaunchMetric({ k, v, tone = "neon" }: { k: string; v: string; tone?: "neon" | "amber" }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="text-[9px] uppercase tracking-widest font-black text-mute">{k}</div>
      <div className={`mt-2 font-mono text-sm font-black ${tone === "amber" ? "text-amber" : "text-neon"}`}>{v}</div>
    </div>
  );
}

function LaunchReadinessChecklist({
  walletConnected,
  artistVerified,
  metadataReady,
  liquidityReady,
  phantomReady,
  tokenTrustReady,
}: {
  walletConnected: boolean;
  artistVerified: boolean;
  metadataReady: boolean;
  liquidityReady: boolean;
  phantomReady: boolean;
  tokenTrustReady: boolean;
}) {
  const items = [
    ["Wallet connected", walletConnected, "External Solana wallet is needed for real launch signing."],
    ["Audius artist verified", artistVerified, "Audius identity links the coin to the real artist account."],
    ["Metadata ready", metadataReady, "Name, symbol, image, description, and token traits are prepared."],
    ["Liquidity ready", liquidityReady, "Public market liquidity is required before fans can buy."],
    ["Phantom review", phantomReady, "Live wallet signing stays paused until the domain is trusted."],
    ["Token trust", tokenTrustReady, "Ownership, risk, vesting, and cap checks are accepted."],
  ] as const;
  return (
    <section className="relative z-10 rounded-2xl border border-edge bg-panel p-4">
      <div className="text-[10px] uppercase tracking-widest font-black text-ink">Open Audio launch checklist</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, ok, hint]) => (
          <div key={label} className="rounded-xl border border-edge bg-panel2 p-3">
            <div className={`text-[10px] uppercase tracking-widest font-black ${ok ? "text-neon" : "text-amber"}`}>
              {ok ? "Ready" : "Waiting"} · {label}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-mute">{hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewCurve({ series }: { series: { x: number; y: number }[] }) {
  const w = 400, h = 180, pad = 20;
  const xs = series.map((p) => p.x), ys = series.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const path = series
    .map((p, i) => {
      const x = pad + ((p.x - xMin) / (xMax - xMin || 1)) * (w - 2 * pad);
      const y = h - pad - ((p.y - yMin) / (yMax - yMin || 1)) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44 drop-shadow-[0_0_15px_rgba(0,229,114,0.1)]">
        <defs>
          <linearGradient id="curveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00E572" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00E572" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L${w - pad},${h - pad} L${pad},${h - pad} Z`} fill="url(#curveGrad)" />
        <path d={path} fill="none" stroke="#00E572" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
