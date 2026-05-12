"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/lib/store";
import { api } from "@/lib/api";
import { fmtNum } from "@/lib/pricing";
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
import { Glossary, InfoTooltip } from "@/components/Tooltip";
import { formatCryptoWithFiat, formatFiatEstimate, priceAgeText, useLiveFiatPrices } from "@/lib/fiat";
import { WalletButton } from "@/components/WalletButton";
import { WalletDiagnostics } from "@/components/WalletDiagnostics";
import { WhyFansCanBuy } from "@/components/WhyFansCanBuy";
import { ChevronRight, ChevronLeft, Rocket, Music, Settings, BarChart3, ShieldCheck, CheckCircle2 } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type LaunchKind = "SONG" | "ARTIST";
type PairAsset = "SOL" | "USDC" | "AUDIO";
type LaunchPresetId = "fan" | "balanced" | "premium" | "custom";

const LAUNCH_PRESETS: Array<{
  id: Exclude<LaunchPresetId, "custom">;
  title: string;
  label: string;
  artistBps: number;
  liquidityBps: number;
  maxWalletBps: number;
  pairAmount: number;
  lockDays: number;
  note: string;
}> = [
  {
    id: "fan",
    title: "Fan First",
    label: "30% artist / 45% liquidity",
    artistBps: 3000,
    liquidityBps: 4500,
    maxWalletBps: 200,
    pairAmount: 0.5,
    lockDays: 180,
    note: "Best for testing a new song with more supply in the public market.",
  },
  {
    id: "balanced",
    title: "Balanced",
    label: "40% artist / 35% liquidity",
    artistBps: 4000,
    liquidityBps: 3500,
    maxWalletBps: 200,
    pairAmount: 1,
    lockDays: 365,
    note: "Recommended default: artist keeps a meaningful stake while fans get real market depth.",
  },
  {
    id: "premium",
    title: "Premium Launch",
    label: "50% artist / 30% liquidity",
    artistBps: 5000,
    liquidityBps: 3000,
    maxWalletBps: 100,
    pairAmount: 3,
    lockDays: 365,
    note: "Stronger launch liquidity and tighter wallet cap for a more serious release.",
  },
];

export function CoinLauncher({ onLaunched }: { onLaunched?: () => void }) {
  const { address, kind, provider, audius } = useSession();
  const externalWalletAddress = kind === "solana" && provider && provider !== "audius" ? address : null;
  const externalWalletProvider = provider && provider !== "audius" ? provider : null;
  const audiusWalletAddress = audius?.wallets?.sol ?? null;
  const launchIdentityWallet = externalWalletAddress || audiusWalletAddress;
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
  const [artistAllocationBps, setArtistAllocationBps] = useState(4000);
  const [launchPreset, setLaunchPreset] = useState<LaunchPresetId>("balanced");
  const [liquidityTokenAmount, setLiquidityTokenAmount] = useState(350_000_000);
  const [liquidityPairAmount, setLiquidityPairAmount] = useState(1);
  const [liquidityPairAsset, setLiquidityPairAsset] = useState<PairAsset>("SOL");
  const [liquidityLockDays, setLiquidityLockDays] = useState(365);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const { currency, prices: fiatPrices, updatedAt: fiatUpdatedAt } = useLiveFiatPrices(["SOL", "AUDIO", "USDC"]);

  // Step 4
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [importMint, setImportMint] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [liquidityStage, setLiquidityStage] = useState<"idle" | "preparing" | "signing" | "confirming" | "live" | "failed">("idle");
  const [liquidityMessage, setLiquidityMessage] = useState<string | null>(null);
  const [launchStatus, setLaunchStatus] = useState<{
    configured: boolean;
    missing?: string[];
    payerConfigured?: boolean;
    treasuryConfigured?: boolean;
    jupiterConfigured?: boolean;
    artistPaysLaunchFees?: boolean;
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
  const canStep3 = launchKind === "ARTIST"
    ? canStep2 && supply === 1_000_000_000 && artistAllocationBps === 5000
    : canStep2 && royaltyValid && supply >= 1_000 && basePrice > 0 && curveSlope >= 0 && !!distributor;
  const liquidityValid = launchKind === "ARTIST" ? true : liquidityTokenAmount > 0 && liquidityPairAmount > 0 && liquidityLockDays >= 30;
  const artistVestedTokenAmount = Math.max(0, Math.round(supply * (artistAllocationBps / 10_000)));
  const launchLiquidityTokenAmount = Math.max(0, Math.round(liquidityTokenAmount));
  const allocationOverbooked = launchKind === "SONG" && artistVestedTokenAmount + launchLiquidityTokenAmount > supply;
  const reserveTokenAmount = launchKind === "SONG"
    ? Math.max(0, Math.round(supply - artistVestedTokenAmount - launchLiquidityTokenAmount))
    : 0;
  const artistWalletMintAmount = launchKind === "SONG"
    ? artistVestedTokenAmount + launchLiquidityTokenAmount
    : supply;
  const liquidityAllocationBps = Math.round((launchLiquidityTokenAmount / Math.max(supply, 1)) * 10_000);
  const allocationRisk = artistAllocationBps > 5000 || maxWalletBps > 1000 || allocationOverbooked;
  const canLaunchReview = canStep3 && liquidityValid && !allocationRisk;
  const impliedPrice = liquidityPairAmount / Math.max(liquidityTokenAmount, 1);
  const launchLiquidityRatio = liquidityTokenAmount / Math.max(supply, 1);
  const reserveBps = Math.max(0, 10_000 - artistAllocationBps - liquidityAllocationBps);
  const projectedDepth = liquidityPairAmount >= 5 ? "Institutional" : liquidityPairAmount >= 1 ? "Healthy" : "Thin";
  const launchImpact = liquidityPairAmount > 0 ? Math.min(25, (1 / liquidityPairAmount) * 2.5) : 25;
  const pairUsdRate = liquidityPairAsset === "USDC" ? 1 : Number(fiatPrices[liquidityPairAsset]?.usd ?? 0);
  const liquidityPairUsd = pairUsdRate > 0 ? liquidityPairAmount * pairUsdRate : null;
  const impliedPriceUsd = pairUsdRate > 0 ? impliedPrice * pairUsdRate : null;
  const solUsdRate = Number(fiatPrices.SOL?.usd ?? 0);
  const audioUsdRate = Number(fiatPrices.AUDIO?.usd ?? 0);
  const estimatedNetworkFeeSol = 0.003;
  const estimatedNetworkFeeUsd = solUsdRate > 0 ? estimatedNetworkFeeSol * solUsdRate : null;
  const creatorFirstBuyUsd = audioUsdRate > 0 ? liquidityPairAmount * audioUsdRate : null;
  const fiatAge = priceAgeText(fiatUpdatedAt);
  const basePriceUsd = solUsdRate > 0 ? basePrice * solUsdRate : null;
  const fullSupplyValueUsd = basePriceUsd != null ? supply * basePriceUsd : null;
  const startingMarketCapUsd = impliedPriceUsd != null ? supply * impliedPriceUsd : null;
  const estimatedPoolValueUsd = liquidityPairUsd != null ? liquidityPairUsd * 2 : null;
  const artistCoinGraduationUsd = audioUsdRate > 0 ? 1_000_000 * audioUsdRate : null;
  const artistCoinInitialMarketCapUsd = audioUsdRate > 0 ? 100_000 * audioUsdRate : null;

  function applyLaunchPreset(preset: typeof LAUNCH_PRESETS[number]) {
    setLaunchPreset(preset.id);
    setArtistAllocationBps(preset.artistBps);
    setMaxWalletBps(preset.maxWalletBps);
    setLiquidityTokenAmount(Math.round(supply * (preset.liquidityBps / 10_000)));
    setLiquidityPairAmount(preset.pairAmount);
    setLiquidityLockDays(preset.lockDays);
    if (liquidityPairAsset === "AUDIO") setLiquidityPairAsset("SOL");
  }

  function markCustom<T extends number>(setter: (value: T) => void) {
    return (value: T) => {
      setLaunchPreset("custom");
      setter(value);
    };
  }

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
  const previewStartPrice = previewSeries[0]?.y ?? 0;
  const previewEndPrice = previewSeries[previewSeries.length - 1]?.y ?? 0;
  const previewStartUsd = solUsdRate > 0 ? previewStartPrice * solUsdRate : null;
  const previewEndUsd = solUsdRate > 0 ? previewEndPrice * solUsdRate : null;

  useEffect(() => {
    if (launchKind !== "ARTIST") return;
    setLaunchPreset("balanced");
    setSupply(1_000_000_000);
    setBasePrice(0);
    setCurveSlope(0);
    setArtistAllocationBps(5000);
    setMaxWalletBps(1000);
    setLiquidityTokenAmount(250_000_000);
    setLiquidityPairAsset("AUDIO");
    setLiquidityLockDays(365 * 5);
  }, [launchKind]);

  async function deploy() {
    if (!externalWalletAddress || !externalWalletProvider) {
      setErr("Connect Phantom, Solflare, or Backpack before launching. Audius verifies the artist, but an external Solana wallet must sign the mint.");
      return;
    }
    if (launchKind === "ARTIST") return deployOpenAudioArtistCoin();
    if (!pick) return;
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
      if (allocationOverbooked) {
        throw new Error("Artist hold plus launch liquidity cannot be more than the total supply. Lower one of the allocation settings.");
      }
      const cleanTitle = String(pick.title ?? "Song Token").replace(/\s+/g, " ").trim();
      const cleanSymbol = cleanTitle.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase() || "SONG";
      const metadataBaseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const paidMint = await createArtistPaidSongMint(externalWalletProvider as WalletId, {
        artistWallet: externalWalletAddress,
        treasuryWallet,
        artistSupply: artistWalletMintAmount,
        treasurySupply: reserveTokenAmount,
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
          clientMint: {
            ...paidMint,
            allocation: {
              artistVestedSupply: artistVestedTokenAmount,
              launchLiquiditySupply: launchLiquidityTokenAmount,
              reserveSupply: reserveTokenAmount,
              artistWalletMintAmount,
            },
          },
        },
      });
      setResult(r);
      setLiquidityStage("preparing");
      setLiquidityMessage("Coin created. Now SONG·DAQ is preparing launch liquidity so fans can buy and sell it.");

      let liquidityTxSig: string | null = null;
      let liquidityPrep: {
        poolId: string;
        lpMint: string;
      } | null = null;
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
        liquidityPrep = { poolId: prep.poolId, lpMint: prep.lpMint };

        const walletId = getConnectedWalletId() || externalWalletProvider;
        setLiquidityStage("signing");
        setLiquidityMessage(`Approve the second wallet transaction. This moves the launch-liquidity coins out of your wallet and pairs them with ${liquidityPairAsset} in the public pool so fans can buy and sell.`);
        liquidityTxSig = await sendSerializedTransaction(walletId as WalletId, prep.transaction);

        setLiquidityStage("confirming");
        setLiquidityMessage("Liquidity transaction sent. Solana and the pool router may need a moment to index it, so SONG·DAQ is verifying before opening trading to fans.");
        let live: any = null;
        let lastLiquidityError: any = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          try {
            setLiquidityMessage(`Liquidity transaction sent. Verifying public pool confirmation (${attempt + 1}/10).`);
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
            await new Promise((resolve) => setTimeout(resolve, 1800 + attempt * 1200));
          }
        }
        if (!live) {
          setLiquidityStage("confirming");
          setLiquidityMessage(
            `Liquidity transaction was sent, but SONG·DAQ is still waiting for the pool to index. Transaction: ${liquidityTxSig}. Refresh the coin page in a moment if it does not switch to live automatically.`,
          );
          setResult({
            ...r,
            launch: {
              ...r.launch,
              liquidityTxSig,
              poolId: prep.poolId,
              lpMint: prep.lpMint,
              tradingStatus: "VERIFYING_LIQUIDITY",
              verifyError: lastLiquidityError?.message ?? null,
            },
          });
          onLaunched?.();
          return;
        }

        setLiquidityStage("live");
        setLiquidityMessage("Launch liquidity is live. Fans can now buy and sell this coin from the public pool.");
        setResult({ ...r, song: live.song || r.song, launch: { ...r.launch, liquidityTxSig, poolId: prep.poolId, lpMint: prep.lpMint, tradingStatus: "LIVE" } });
      } catch (liquidityError: any) {
        if (liquidityTxSig) {
          setLiquidityStage("confirming");
          setLiquidityMessage(
            `Liquidity transaction was sent, but SONG·DAQ could not finish verification yet. Transaction: ${liquidityTxSig}. This usually means Solana or the pool router is still indexing it.`,
          );
          setResult({
            ...r,
            launch: {
              ...r.launch,
              liquidityTxSig,
              poolId: liquidityPrep?.poolId,
              lpMint: liquidityPrep?.lpMint,
              tradingStatus: "VERIFYING_LIQUIDITY",
            },
          });
        } else {
          setLiquidityStage("failed");
          setLiquidityMessage(liquidityError?.message || "Coin was created, but it still needs liquidity. Liquidity means putting reserved song coins plus SOL, USDC, or AUDIO into the public pool so fans can buy and sell.");
        }
      }
      onLaunched?.();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deployOpenAudioArtistCoin() {
    if (!externalWalletAddress || !externalWalletProvider) {
      setErr("Connect Phantom, Solflare, or Backpack before launching. Audius verifies the artist, but an external Solana wallet signs the Open Audio Artist Coin transaction.");
      return;
    }
    setBusy(true); setErr(null);
    setLiquidityStage("preparing");
    setLiquidityMessage("Preparing the Open Audio AUDIO-paired Artist Coin transaction.");
    try {
      if (audius) {
        const link = await fetch("/api/audius/link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: externalWalletAddress, walletType: "solana", profile: audius, role: "ARTIST" }),
        });
        if (!link.ok) {
          const j = await link.json().catch(() => ({}));
          console.warn("Could not persist Audius wallet link before Artist Coin launch", j.error);
        }
      }
      const artistName = audius?.name || audius?.handle || "Artist";
      const prep = await api<{
        transaction: string;
        mint: string;
        poolAddress: string;
        config: string;
        quoteMint: string;
        name: string;
        symbol: string;
        metadataUri: string;
        message: string;
      }>("/api/open-audio/artist-coins/launch", {
        method: "POST",
        json: {
          wallet: externalWalletAddress,
          artistName,
          symbol: audius?.handle || artistName,
          initialBuyAmountAudio: Number(liquidityPairAmount || 0),
        },
      });
      setLiquidityStage("signing");
      setLiquidityMessage(prep.message || "Approve the Artist Coin launch transaction in your Solana wallet.");
      const walletId = getConnectedWalletId() || externalWalletProvider;
      const signature = await sendSerializedTransaction(walletId as WalletId, prep.transaction);
      setLiquidityStage("confirming");
      setLiquidityMessage("Artist Coin transaction sent. Verifying the AUDIO-paired bonding curve.");
      const recorded = await api<any>("/api/open-audio/artist-coins/record", {
        method: "POST",
        json: {
          wallet: externalWalletAddress,
          artistName,
          symbol: prep.symbol,
          mint: prep.mint,
          poolAddress: prep.poolAddress,
          signature,
          initialBuyAmountAudio: Number(liquidityPairAmount || 0),
        },
      });
      setResult({ ...recorded, launch: { mintTx: signature, metadataUri: prep.metadataUri, poolAddress: prep.poolAddress, quoteMint: prep.quoteMint } });
      setLiquidityStage("live");
      setLiquidityMessage("Open Audio Artist Coin launched with an AUDIO-paired Meteora bonding curve.");
      onLaunched?.();
    } catch (e: any) {
      setErr(e?.message ?? "Artist Coin launch failed");
      setLiquidityStage("failed");
      setLiquidityMessage("Artist Coin launch did not complete. No live SONG·DAQ market opens until the transaction is confirmed.");
    } finally {
      setBusy(false);
    }
  }

  async function importOpenAudioArtistCoin() {
    if (!launchIdentityWallet) {
      setErr("Connect an external Solana wallet or sign in with an Audius account that exposes an Audius Solana wallet first.");
      return;
    }
    const mint = importMint.trim();
    if (!mint) {
      setErr("Paste the official Audius/Open Audio Artist Coin mint address first.");
      return;
    }
    setImportBusy(true);
    setErr(null);
    setImportMessage("Checking the Audius coin list and preparing the SONG·DAQ market page.");
    try {
      if (audius) {
        const link = await fetch("/api/audius/link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: launchIdentityWallet, walletType: "solana", profile: audius, role: "ARTIST" }),
        });
        if (!link.ok) {
          const j = await link.json().catch(() => ({}));
          console.warn("Could not persist Audius wallet link before Artist Coin import", j.error);
        }
      }
      const imported = await api<any>("/api/open-audio/artist-coins/import", {
        method: "POST",
        json: {
          wallet: launchIdentityWallet,
          mint,
          artistName: audius?.name || audius?.handle,
          symbol: audius?.handle || audius?.name,
          audiusUrl: audius?.handle ? `https://audius.co/${audius.handle}` : undefined,
        },
      });
      setResult(imported);
      setLiquidityStage("live");
      setLiquidityMessage("Imported from Audius/Open Audio. SONG·DAQ now has the coin page, trading context, portfolio record, royalty setup, and admin tracking.");
      setImportMessage("Imported. Open the token detail page to manage the SONG·DAQ side.");
      setStep(5);
      onLaunched?.();
    } catch (e: any) {
      setErr(e?.message || "Could not import this Audius Artist Coin.");
      setImportMessage(null);
    } finally {
      setImportBusy(false);
    }
  }

  if (!audius) {
    return (
      <div className="panel p-5 sm:p-10 text-center text-mute uppercase tracking-widest font-bold text-xs bg-panel2 border-dashed border-edge">
        Sign in with Audius to verify your artist identity before launching a song token.
      </div>
    );
  }

  if (!launchIdentityWallet) {
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
          onClick={() => { setLaunchKind("SONG"); setLiquidityPairAsset("SOL"); setBasePrice(0.001); setCurveSlope(0.0000005); setStep(1); setErr(null); }}
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

      {!externalWalletAddress && audiusWalletAddress && (
        <div className="relative z-10 rounded-xl border border-violet/25 bg-violet/10 px-4 py-3 text-violet flex items-start gap-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-black">Audius wallet recognized</div>
            <div className="mt-1 text-xs leading-relaxed text-violet/85">
              SONG·DAQ can use your Audius wallet for artist identity, imported Audius/Open Audio coins, and coin setup records. A live Solana mint still needs an external wallet signature until Open Audio exposes an in-app signing bridge for third-party apps.
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-violet/25 bg-panel px-3 py-2 font-mono text-[10px] text-ink">
                {audiusWalletAddress.slice(0, 6)}…{audiusWalletAddress.slice(-4)}
              </span>
              <WalletButton compact connectOnly />
            </div>
          </div>
        </div>
      )}

      <LaunchReadinessChecklist
        walletConnected={!!launchIdentityWallet}
        artistVerified={!!audius?.userId}
        metadataReady={!!(process.env.NEXT_PUBLIC_APP_URL || typeof window !== "undefined")}
        liquidityReady={liquidityValid}
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
                      <div className="mt-1 text-2xl font-black text-ink whitespace-normal break-words">{audius.name || audius.handle}</div>
                      <div className="text-xs text-mute">@{audius.handle}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] uppercase tracking-widest font-bold">
                      <div className="rounded-xl border border-edge bg-panel2 p-3 text-mute">{externalWalletAddress ? "External wallet" : "Audius wallet"} <span className="block font-mono text-ink normal-case tracking-normal truncate">{launchIdentityWallet.slice(0, 6)}…{launchIdentityWallet.slice(-4)}</span></div>
                      <div className="rounded-xl border border-edge bg-panel2 p-3 text-mute">Audio <span className="block text-amber">Unavailable until song attached</span></div>
                    </div>
                    <div className="rounded-2xl border border-violet/25 bg-violet/10 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-violet">Option C: launch on Audius, run everything else on SONG·DAQ</div>
                      <p className="mt-2 text-xs leading-relaxed text-violet/85">
                        If you already launched an Artist Coin on Audius, paste the official mint here. SONG·DAQ will build the coin page, chart, portfolio, royalty setup, admin tracking, and trading context around it.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          value={importMint}
                          onChange={(e) => setImportMint(e.target.value)}
                          placeholder="Paste Audius Artist Coin mint address"
                          className="min-w-0 rounded-xl border border-edge bg-panel px-3 py-3 font-mono text-xs text-ink outline-none transition focus:border-violet"
                        />
                        <button
                          type="button"
                          onClick={importOpenAudioArtistCoin}
                          disabled={importBusy || !importMint.trim()}
                          className="rounded-xl border border-violet/30 bg-violet/15 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-violet transition hover:bg-violet/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {importBusy ? "Importing" : "Import"}
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href="https://audius.co/clubs"
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-edge bg-panel px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-ink transition hover:border-violet/40 hover:text-violet"
                        >
                          Open Audius Coins
                        </a>
                        <span className="text-[10px] leading-relaxed text-mute">Official launch stays on Audius. SONG·DAQ imports the public mint after it exists.</span>
                      </div>
                      {importMessage && <div className="mt-3 text-xs font-bold text-neon">{importMessage}</div>}
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
                  {launchKind === "ARTIST" ? (
                    <div className="grid gap-3">
                      <LaunchMetric k="Supply" v="1.00B" />
                      <LaunchMetric k="Decimals" v="9" />
                      <LaunchMetric k="Quote Asset" v="$AUDIO" tone="neon" />
                      <LaunchMetric k="Artist Vesting" v="50% / 5Y" tone="violet" />
                      <LaunchMetric k="Graduation" v="1M AUDIO" tone="neon" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 px-1">
                          <div>
                            <div className="text-[10px] uppercase tracking-widest font-black text-mute">Automatic Launch Settings</div>
                            <div className="mt-1 text-xs text-mute">Choose how much the artist holds, how much opens the market, and how tight the wallet cap is.</div>
                          </div>
                          <span className="hidden sm:inline-flex rounded-full border border-edge bg-panel px-2.5 py-1 text-[8px] uppercase tracking-widest font-black text-mute">
                            {launchPreset === "custom" ? "Custom" : "Preset"}
                          </span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          {LAUNCH_PRESETS.map((preset) => {
                            const active = launchPreset === preset.id;
                            const presetUsd = solUsdRate > 0 ? preset.pairAmount * solUsdRate : null;
                            return (
                              <button
                                type="button"
                                key={preset.id}
                                onClick={() => applyLaunchPreset(preset)}
                                className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                                  active ? "border-neon/35 bg-neon/10 shadow-[0_0_18px_rgba(0,229,114,0.12)]" : "border-edge bg-panel hover:border-white/20 hover:bg-panel2"
                                }`}
                              >
                                <div className={`text-[10px] uppercase tracking-widest font-black ${active ? "text-neon" : "text-ink"}`}>{preset.title}</div>
                                <div className="mt-1 font-mono text-[11px] font-black text-white">{preset.label}</div>
                                <div className="mt-1 font-mono text-[10px] font-black text-neon">
                                  {formatCryptoWithFiat(preset.pairAmount, "SOL", presetUsd, currency)}
                                </div>
                                <p className="mt-2 text-[10px] leading-relaxed text-mute">{preset.note}</p>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setLaunchPreset("custom")}
                            className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                              launchPreset === "custom" ? "border-violet/40 bg-violet/10 text-violet" : "border-edge bg-panel hover:border-white/20 hover:bg-panel2"
                            }`}
                          >
                            <div className="text-[10px] uppercase tracking-widest font-black">Custom</div>
                            <div className="mt-1 font-mono text-[11px] font-black text-white">Manual tokenomics</div>
                            <p className="mt-2 text-[10px] leading-relaxed text-mute">Fine-tune every number yourself.</p>
                          </button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-4">
                          <LaunchMetric
                            k="Artist holds"
                            v={`${(artistAllocationBps / 100).toFixed(0)}%`}
                            tone="violet"
                            help="This is the artist's long-term share. It is separate from the coins used to make the public pool."
                          />
                          <LaunchMetric
                            k="Liquidity / public"
                            v={`${(launchLiquidityRatio * 100).toFixed(0)}%`}
                            tone="neon"
                            help="These coins are staged in the artist wallet only long enough to pair them with SOL, USDC, or AUDIO. After liquidity is added, fans buy from the public pool."
                          />
                          <LaunchMetric
                            k="Reserve"
                            v={`${(reserveBps / 100).toFixed(0)}%`}
                            help="Reserve coins are not sent to the artist wallet. They stay in the SONG·DAQ reserve/treasury for future liquidity support, royalty pool mechanics, or admin-controlled platform operations."
                          />
                          <LaunchMetric
                            k="Wallet cap"
                            v={`${(maxWalletBps / 100).toFixed(2)}%`}
                            help="Wallet cap is the most one buyer should hold during launch. It helps prevent one wallet from taking too much supply early."
                          />
                        </div>
                        <div className="rounded-xl border border-neon/20 bg-neon/10 p-3 text-xs leading-relaxed text-neon/90">
                          One-click mode sets the split automatically: artist hold, launch liquidity for buyers, and reserve. During launch your wallet may briefly hold the liquidity portion, then the second approval moves that portion into the public pool.
                        </div>
                      </div>
                      <Field
                        label="Total Issuance"
                        value={supply}
                        onChange={markCustom(setSupply)}
                        step={1000}
                        min={1000}
                        unit="Tokens"
                        description={`Total supply estimate: ${formatFiatEstimate(fullSupplyValueUsd, currency)}. If all coins were counted at the starting price, this would be the estimated value. The real market value can be much lower or higher once people start trading.`}
                      />
                      <Field
                        label="Starting token price"
                        value={basePrice}
                        onChange={markCustom(setBasePrice)}
                        step={0.0001}
                        min={0}
                        unit="SOL"
                        help="This is the estimated price for 1 song coin at launch. The price can move up or down once people start buying and selling."
                        description={`Starting token price: ${formatCryptoWithFiat(basePrice, "SOL", basePriceUsd, currency, 6)}.`}
                      />
                      <Field
                        label="Curve Momentum"
                        value={curveSlope}
                        onChange={markCustom(setCurveSlope)}
                        step={0.0000001}
                        min={0}
                        unit="Slope"
                        help="Curve momentum controls how quickly the token price can rise as more people buy. Higher momentum can make early buys move the price faster. Lower momentum makes price movement slower and smoother."
                        description="Use a lower number for a calmer launch. Use a higher number only if you want the price curve to react more aggressively to demand."
                      />
                      <Field
                        label="Max Wallet Cap"
                        value={maxWalletBps / 100}
                        onChange={(n) => { setLaunchPreset("custom"); setMaxWalletBps(Math.round(n * 100)); }}
                        step={0.25}
                        min={0.1}
                        unit="% of supply"
                        help="Max wallet cap is the most one wallet should be allowed to hold during launch. It helps stop one buyer from taking too much of the supply at the start."
                        description="A smaller cap spreads coins across more fans. A larger cap lets bigger buyers take a bigger position."
                      />
                      <Field
                        label="Artist Hold / Vesting Allocation"
                        value={artistAllocationBps / 100}
                        onChange={(n) => { setLaunchPreset("custom"); setArtistAllocationBps(Math.round(n * 100)); }}
                        step={0.25}
                        min={0}
                        unit="% of supply"
                        help="This is the artist's share of the total token supply. Vesting means the artist's share is held over time instead of all being freely sellable right away."
                        description="Keeping the artist share vested helps fans trust that the artist is aligned with the coin long term."
                      />
                    </>
                  )}
                  {allocationRisk && (
                    <div className="rounded-xl border border-amber/20 bg-amber/10 p-3 text-xs text-amber">
                      {allocationOverbooked
                        ? "Artist hold plus launch liquidity is over 100% of supply. Lower artist hold or liquidity tokens so the reserve does not go negative."
                        : "This does not match the Audius-style model. Keep artist vesting at or below 50% and max wallet cap at or below 10%."}
                    </div>
                  )}
                  <div className="rounded-xl border border-violet/20 bg-violet/10 p-3 text-xs leading-relaxed text-violet/85">
                    {launchKind === "ARTIST"
                      ? "Audius-style artist coins use a 1B supply, 9 decimals, $AUDIO quote asset, Meteora bonding curve, and 50% creator vesting. Fans buy from the curve, not from a hidden artist wallet."
                      : "Song Tokens are tied to one Audius track. The artist launches a fixed-supply song coin, then opens trading by pairing reserved song coins with SOL, USDC, or AUDIO liquidity."}
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
                      <div className="text-[9px] uppercase tracking-widest font-bold text-mute">Starting token price</div>
                      <div className="font-mono text-sm font-bold text-white">{formatCryptoWithFiat(previewStartPrice, "SOL", previewStartUsd, currency, 6)}</div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="text-[9px] uppercase tracking-widest font-bold text-mute">Projected token price</div>
                      <div className="font-mono text-sm font-bold text-neon">{formatCryptoWithFiat(previewEndPrice, "SOL", previewEndUsd, currency, 6)}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-edge bg-panel2 p-3 text-[10px] uppercase tracking-widest text-mute">
                    {fiatAge}
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
                  <Row k="Total supply estimate" v={`${fmtNum(supply)} tokens · ${formatFiatEstimate(fullSupplyValueUsd, currency)}`} help="If all coins were counted at the starting price, this would be the estimated value. The real market value can be much lower or higher once people start trading." />
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
                <ShieldCheck size={14} className="text-neon" /> Step 04 — Add Liquidity
              </div>
              <div className="rounded-2xl border border-neon/20 bg-neon/8 p-5 text-neon">
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest font-black">
                  <span>{launchKind === "ARTIST" ? "Open Audio bonding curve opens the coin for fans" : "Liquidity opens the coin for fans"}</span>
                  <InfoTooltip
                    side="bottom"
                    def="Liquidity is the public market supply. You put song coins and a payment coin like SOL, USDC, or AUDIO into a pool. Fans buy from that pool instead of buying directly from the artist."
                  />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neon/85">
                  {launchKind === "ARTIST"
                    ? "Fans buy Artist Coins from a public curve quoted in $AUDIO. The artist's share is separate, so fans are buying from the market instead of a hidden artist wallet."
                    : "Your song coin can exist on-chain before fans can trade it. This step opens the public market by pairing reserved song coins with SOL, USDC, or AUDIO."}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <LiquidityExplainer
                  title="What is liquidity?"
                  body="Liquidity is the supply that makes trading possible. You add song coins and a payment coin so fans have a real pool to buy from and sell into."
                />
                <LiquidityExplainer
                  title="Why two sides?"
                  body="Song coins are what fans receive. SOL, USDC, or AUDIO is what fans pay with. The mix creates the starting price."
                />
                <LiquidityExplainer
                  title="Why it matters"
                  body="Without liquidity, the coin can exist but trading feels stuck. More liquidity usually makes buying and selling smoother, but it does not guarantee profit."
                />
              </div>
              {launchKind === "ARTIST" ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <LaunchMetric k="Public curve supply" v="25%" />
                  <LaunchMetric k="Quote asset" v="$AUDIO" tone="violet" />
                  <LaunchMetric k="Initial market cap" v={formatCryptoWithFiat(100_000, "AUDIO", artistCoinInitialMarketCapUsd, currency, 0)} />
                  <LaunchMetric k="Graduation target" v={formatCryptoWithFiat(1_000_000, "AUDIO", artistCoinGraduationUsd, currency, 0)} />
                  <LaunchMetric k="Locked AMM liquidity" v="20%" />
                  <LaunchMetric k="Reward pool" v="5%" tone="violet" />
                  <Field
                    label="Optional creator first buy"
                    value={liquidityPairAmount}
                    onChange={markCustom(setLiquidityPairAmount)}
                    step={1}
                    min={0}
                    unit="$AUDIO"
                    help="Optional first buy means the artist buys a small amount of their own artist coin at launch using AUDIO. It is not required."
                    description={`Leave this at 0 if you only want to create the public curve. Optional first buy: ${formatCryptoWithFiat(liquidityPairAmount, "AUDIO", creatorFirstBuyUsd, currency)}.`}
                  />
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  <Field
                    label="Liquidity song coins"
                    value={liquidityTokenAmount}
                    onChange={markCustom(setLiquidityTokenAmount)}
                    step={1000}
                    min={1}
                    unit="Tokens"
                    help="This is how many of the new song coins go into the public market. Fans buy from this pool instead of buying directly from the artist."
                    description={`This is the song-coin side of liquidity. Estimated total starting pool value: ${formatFiatEstimate(estimatedPoolValueUsd, currency)}.`}
                  />
                  <Field
                    label={`Liquidity payment side (${liquidityPairAsset})`}
                    value={liquidityPairAmount}
                    onChange={markCustom(setLiquidityPairAmount)}
                    step={0.1}
                    min={0.01}
                    unit={liquidityPairAsset}
                    help={`This is the ${liquidityPairAsset} that sits next to the song coins. Together, the song coins plus ${liquidityPairAsset} create the first market price.`}
                    description={`This is the payment side of liquidity: ${formatCryptoWithFiat(liquidityPairAmount, liquidityPairAsset, liquidityPairUsd, currency)}.`}
                  />
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-mute px-1">
                      <span>Liquidity Payment Coin</span>
                      <InfoTooltip
                        side="bottom"
                        def="Pick what fans use to buy the song coin. SOL is the easiest for most Solana wallets. USDC is dollar-style. AUDIO connects to the Audius ecosystem, but routes can depend on wallet and pool support."
                      />
                    </label>
                    <select value={liquidityPairAsset} onChange={(e) => { setLaunchPreset("custom"); setLiquidityPairAsset(e.target.value as PairAsset); }} className="w-full bg-panel border border-edge rounded-xl px-4 py-3 text-sm text-ink">
                      <option value="SOL">SOL</option>
                      <option value="USDC">USDC</option>
                      <option value="AUDIO">AUDIO</option>
                    </select>
                    <p className="px-1 text-[11px] leading-relaxed text-mute">SOL is the recommended starting choice while wallet and routing support improves.</p>
                  </div>
                  <Field
                    label="Liquidity lock time"
                    value={liquidityLockDays}
                    onChange={markCustom(setLiquidityLockDays)}
                    step={30}
                    min={30}
                    unit="Days"
                    help="This is how long the launch market stays committed. Locking liquidity helps fans trust the market will not disappear right after launch."
                    description="Longer lock times usually look safer to buyers."
                  />
                </div>
              )}
              <div className="panel p-5 bg-panel border-edge rounded-2xl space-y-3">
                <Row k="Starting price" v={launchKind === "ARTIST" ? "Open Audio curve config" : `${impliedPrice.toFixed(8)} ${liquidityPairAsset} ${formatFiatEstimate(impliedPriceUsd, currency, 4)}`} color="text-neon" help="The starting price is estimated from how many song coins and how much payment coin you put into the market." />
                <Row k="Starting market value" v={launchKind === "ARTIST" ? formatCryptoWithFiat(100_000, "AUDIO", artistCoinInitialMarketCapUsd, currency, 0) : formatFiatEstimate(startingMarketCapUsd, currency)} help="This is a rough estimate using the starting price and total supply. Real value can change after trading begins." />
                <Row k="Launch liquidity" v={launchKind === "ARTIST" ? formatCryptoWithFiat(liquidityPairAmount, "AUDIO", creatorFirstBuyUsd, currency) : formatCryptoWithFiat(liquidityPairAmount, liquidityPairAsset, liquidityPairUsd, currency)} color="text-neon" help="This is the real-world estimate of the payment coin being added to the launch liquidity pool." />
                {launchKind !== "ARTIST" && <Row k="Estimated pool value" v={formatFiatEstimate(estimatedPoolValueUsd, currency)} help="A liquidity pool has two sides. This estimate counts the payment side plus the song-coin side at the same starting value." />}
                <Row k="Estimated network fee" v={formatCryptoWithFiat(estimatedNetworkFeeSol, "SOL", estimatedNetworkFeeUsd, currency)} help="Solana network fees move. This is an estimate, not a guaranteed final charge." />
                <Row k="Expected price movement" v={launchKind === "ARTIST" ? "Curve quoted in AUDIO" : liquidityPairAmount >= 1 ? "Low/Medium" : "High"} color={launchKind === "ARTIST" || liquidityPairAmount >= 1 ? "text-neon" : "text-amber"} help="If the market is small, one buy or sell can move the price more. A deeper market usually moves less." />
                <Row k="Market source" v={launchKind === "ARTIST" ? "Meteora Dynamic Bonding Curve" : "Public pool approval"} help="This tells you where fans will buy. The public pool or curve is the market, not a hidden artist wallet." />
                <Row k="Trust lock" v={launchKind === "ARTIST" ? "50% creator vesting over 5 years" : `${liquidityLockDays} days required`} color="text-neon" help="A lock or vesting schedule helps show fans the launch is not just a quick sellout by the artist." />
                <div className="pt-1 text-[9px] uppercase tracking-widest text-mute">{fiatAge}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <LaunchMetric k="Pool depth" v={projectedDepth} />
                <LaunchMetric k="Reserve target" v={`${(launchLiquidityRatio * 100).toFixed(1)}%`} />
                <LaunchMetric k="1 SOL impact" v={`${launchImpact.toFixed(2)}%`} tone={launchImpact > 5 ? "amber" : "neon"} />
                <LaunchMetric k="Wallet cap" v={`${(maxWalletBps / 100).toFixed(2)}%`} />
              </div>
              {!liquidityValid && (
                <div className="rounded-xl border border-red/20 bg-red/10 p-4 text-sm text-red">
                  Add enough launch liquidity before launch. This gives buyers a real public pool to trade against.
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
                      {!externalWalletAddress
                        ? "Your Audius wallet is recognized for identity and setup. Connect Phantom, Solflare, or Backpack when you are ready to sign the live Solana mint transaction."
                        : launchKind === "ARTIST"
                        ? "Your connected artist wallet signs the Open Audio Artist Coin launch. The coin is paired against $AUDIO on a Meteora bonding curve so fans buy from the public market."
                        : "Your connected artist wallet signs a clear launch flow. The coin is not tradable until the public curve/pool has verified liquidity, so fans can buy from the market instead of from the artist directly."}
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="panel p-4 text-left space-y-2 bg-panel border-edge">
                      <div className="text-[10px] uppercase tracking-widest font-black text-white">Launch summary</div>
                      <Row k={launchKind === "ARTIST" ? "Artist" : "Song"} v={launchKind === "ARTIST" ? (audius?.name || audius?.handle || "Artist coin") : (pick?.title ?? "Song coin")} />
                      <Row k="Supply" v={launchKind === "ARTIST" ? "1B / 9 decimals" : fmtNum(supply)} />
                      <Row k="Market" v={launchKind === "ARTIST" ? `Meteora DBC vs $AUDIO · ${formatCryptoWithFiat(liquidityPairAmount, "AUDIO", creatorFirstBuyUsd, currency)}` : `${fmtNum(liquidityTokenAmount)} tokens + ${formatCryptoWithFiat(liquidityPairAmount, liquidityPairAsset, liquidityPairUsd, currency)}`} color="text-neon" />
                      <Row k="Estimated network fee" v={formatCryptoWithFiat(estimatedNetworkFeeSol, "SOL", estimatedNetworkFeeUsd, currency)} />
                      <Row k="Trading opens" v={launchKind === "ARTIST" ? "After AUDIO curve transaction confirms" : "After liquidity transaction verifies"} color="text-neon" />
                      <Row k="Vesting / lock" v={launchKind === "ARTIST" ? "50% artist vesting over 5 years" : `${liquidityLockDays} days`} />
                      <Row
                        k="Artist hold"
                        v={`${(artistAllocationBps / 100).toFixed(2)}% · ${fmtNum(artistVestedTokenAmount)}`}
                        help="This is the artist's intended long-term allocation. It is not the full supply."
                      />
                      {launchKind === "SONG" ? (
                        <>
                          <Row
                            k="Liquidity for fans"
                            v={`${(liquidityAllocationBps / 100).toFixed(2)}% · ${fmtNum(launchLiquidityTokenAmount)}`}
                            color="text-neon"
                            help="These coins are used to make the buy/sell pool. They may stage in your wallet briefly, then move into the public pool when you approve liquidity."
                          />
                          <Row
                            k="Reserve"
                            v={`${(reserveBps / 100).toFixed(2)}% · ${fmtNum(reserveTokenAmount)}`}
                            help="Reserve coins are minted to the reserve/treasury account, not kept as artist-owned coins."
                          />
                        </>
                      ) : null}
                      <Row k="Max wallet cap" v={`${(maxWalletBps / 100).toFixed(2)}%`} />
                      <Row k="Royalty status" v="Pending verification" color="text-amber" />
                      <Row k="Signing policy" v="Wallet transaction only. No private key. No blind message." color="text-neon" />
                    </div>
                    <div className="panel p-4 text-left space-y-3 bg-panel border-edge">
                      <div className="text-[10px] uppercase tracking-widest font-black text-white">Wallet approval preview</div>
                      <div className="space-y-3 text-xs leading-relaxed text-mute">
                        <div>
                          <span className="font-black text-neon">Approval 1:</span> {launchKind === "ARTIST" ? "creates the Artist Coin pool on Meteora Dynamic Bonding Curve using the AUDIO quote mint." : `creates the SPL mint, attaches SONG·DAQ metadata, mints ${fmtNum(artistVestedTokenAmount)} artist-hold coins plus ${fmtNum(launchLiquidityTokenAmount)} liquidity-staging coins to your wallet, sends ${fmtNum(reserveTokenAmount)} reserve coins to treasury, disables freeze authority, and revokes mint authority.`}
                        </div>
                        <div>
                          <span className="font-black text-neon">{launchKind === "ARTIST" ? "Optional first buy:" : "Approval 2:"}</span> {launchKind === "ARTIST" ? `if entered, your wallet also buys with ${formatCryptoWithFiat(liquidityPairAmount || 0, "AUDIO", creatorFirstBuyUsd, currency)} in the same launch flow.` : `creates the public liquidity pool with the token amount and ${formatCryptoWithFiat(liquidityPairAmount, liquidityPairAsset, liquidityPairUsd, currency)} shown here.`}
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
                        <li>{launchKind === "ARTIST" ? "Uses the Open Audio Artist Coin standard: 1B supply and 9 decimals." : "Fixed supply is created once."}</li>
                        <li>{launchKind === "ARTIST" ? "Pairs the public market against the official $AUDIO mint." : "Freeze authority is disabled."}</li>
                        <li>{launchKind === "ARTIST" ? "Artist allocation vests separately over 5 years." : "Artist hold, launch liquidity, and reserve are separated before trading opens."}</li>
                        <li>{launchKind === "ARTIST" ? "The public curve is created in the launch transaction." : "Mint authority is revoked in the same mint transaction."}</li>
                        <li>Metadata includes artist identity, image, protocol, royalty status, and liquidity status.</li>
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
                    <div className="mb-1 text-[10px] uppercase tracking-widest font-black text-neon">{fiatAge}</div>
                    {launchKind === "ARTIST"
                      ? "Open Audio Artist Coins use a $AUDIO-paired public bonding curve plus artist vesting. Your wallet signs the live transaction and SONG·DAQ shows the real wallet or backend result."
                      : "Audius-style launches use a public market curve plus artist vesting. Your wallet signs the live transaction and SONG·DAQ shows the real wallet or backend result."}
                  </div>
                  <button
                    type="button"
                    className="btn-primary w-full py-4 text-sm font-black tracking-widest shadow-[0_0_30px_rgba(0,229,114,0.3)] disabled:opacity-50 disabled:grayscale"
                    onClick={deploy}
                    disabled={!externalWalletAddress || !canLaunchReview || !ownershipConfirmed || !riskAcknowledged}
                  >
                    {!externalWalletAddress ? "CONNECT EXTERNAL WALLET TO SIGN" : launchKind === "ARTIST" ? "SIGN AUDIO ARTIST COIN LAUNCH" : "SIGN MINT + ADD LIQUIDITY"}
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
                    <div className="text-mute text-sm font-medium">
                      {result.launch?.mintTx === "Imported from Audius/Open Audio"
                        ? `Successfully imported ${result.song?.symbol} into SONG·DAQ.`
                        : `Successfully minted ${result.song?.symbol} on Solana.`}
                    </div>
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
                      Fans buy from the liquidity pool, not from a hidden artist wallet. The artist hold is separate. The launch-liquidity portion moves into the public pool with paired SOL, USDC, or AUDIO so buyers have a market to trade against.
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
  label, value, onChange, step, min, unit, help, description
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  unit: string;
  help?: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase tracking-widest font-bold text-mute px-1 flex justify-between gap-3">
        <span className="inline-flex items-center gap-1.5">
          {label}
          {help ? <InfoTooltip side="bottom" def={help} /> : null}
        </span>
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
      {description ? <p className="px-1 text-[11px] leading-relaxed text-mute">{description}</p> : null}
    </div>
  );
}

function Row({ k, v, color, help }: { k: string; v: string; color?: string; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-edge last:border-0">
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-mute">
        {k}
        {help ? <InfoTooltip side="bottom" def={help} /> : null}
      </span>
      <span className={`font-mono text-xs font-bold ${color || "text-white"}`}>{v}</span>
    </div>
  );
}

function LiquidityExplainer({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-panel/80 p-4">
      <div className="text-[10px] uppercase tracking-widest font-black text-ink">{title}</div>
      <p className="mt-2 text-xs leading-relaxed text-mute">{body}</p>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="text-[8px] uppercase tracking-widest font-black px-2 py-1 rounded bg-panel2 text-mute border border-edge">{label}</span>;
}

function LaunchMetric({ k, v, tone = "neon", help }: { k: string; v: string; tone?: "neon" | "amber" | "violet"; help?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-mute">
        {k}
        {help ? <InfoTooltip side="bottom" def={help} /> : null}
      </div>
      <div className={`mt-2 font-mono text-sm font-black ${tone === "amber" ? "text-amber" : tone === "violet" ? "text-violet" : "text-neon"}`}>{v}</div>
    </div>
  );
}

function LaunchReadinessChecklist({
  walletConnected,
  artistVerified,
  metadataReady,
  liquidityReady,
  tokenTrustReady,
}: {
  walletConnected: boolean;
  artistVerified: boolean;
  metadataReady: boolean;
  liquidityReady: boolean;
  tokenTrustReady: boolean;
}) {
  const items = [
    ["Wallet connected", walletConnected, "External Solana wallet is needed for real launch signing."],
    ["Audius artist verified", artistVerified, "Audius identity links the coin to the real artist account."],
    ["Metadata ready", metadataReady, "Name, symbol, image, description, and token traits are prepared."],
    ["Liquidity ready", liquidityReady, "Public market liquidity is required before fans can buy."],
    ["Token details", tokenTrustReady, "Ownership, risk, vesting, and cap settings are accepted."],
  ] as const;
  return (
    <section className="relative z-10 rounded-2xl border border-edge bg-panel p-4">
      <div className="text-[10px] uppercase tracking-widest font-black text-ink">Open Audio launch checklist</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, ok, hint]) => (
          <div key={label} className="rounded-xl border border-edge bg-panel2 p-3">
            <div className={`text-[10px] uppercase tracking-widest font-black ${ok ? "text-neon" : "text-amber"}`}>
              {ok ? "Ready" : "Needs input"} · {label}
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
