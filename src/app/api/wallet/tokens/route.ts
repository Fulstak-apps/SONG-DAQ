import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetchTimeout";
import { prisma } from "@/lib/db";
import { hasProductionDatabaseUrl } from "@/lib/appMode";
import { getAssetUsdRates, valueLocalSongCoin } from "@/lib/serverAssetPrices";
import { calculateSupplyDistribution, getBurnedSupplyFromEvents } from "@/lib/supplyDistribution";

export const dynamic = "force-dynamic";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
// $AUDIO on Solana (Wormhole-wrapped)
const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";
const MAX_FULL_TOKENS = 80;
const MAX_METADATA_LOOKUPS = 30;
const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";
const JUPITER_TOKEN_API = "https://api.jup.ag/tokens/v2/search";
const JUPITER_API_KEY = process.env.JUPITER_API_KEY;

interface ParsedToken {
  mint: string;
  amount: number;
  decimals: number;
}

interface PriceInfo {
  usdPrice?: number;
  price?: number;
  priceChange24h?: number;
}

interface JupiterTokenInfo {
  id?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  decimals?: number;
  usdPrice?: number;
  isVerified?: boolean;
  organicScoreLabel?: string;
  tags?: string[];
}

async function fetchTokenAccounts(owner: string, programId: string): Promise<ParsedToken[]> {
  try {
    const r = await fetchJson<any>(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          owner,
          { programId },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ],
      }),
    }, 5_000);
    const j = r;
    const value = j?.result?.value ?? [];
    return value.map((acc: any) => {
      const info = acc?.account?.data?.parsed?.info ?? {};
      const ta = info.tokenAmount ?? {};
      return {
        mint: info.mint as string,
        amount: Number(ta.uiAmountString ?? ta.uiAmount ?? 0),
        decimals: Number(ta.decimals ?? 0),
      } as ParsedToken;
    });
  } catch {
    return [];
  }
}

async function fetchMintAccounts(owner: string, mint: string): Promise<ParsedToken[]> {
  try {
    const j = await fetchJson<any>(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          owner,
          { mint },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ],
      }),
    }, 4_000);
    const value = j?.result?.value ?? [];
    return value.map((acc: any) => {
      const info = acc?.account?.data?.parsed?.info ?? {};
      const ta = info.tokenAmount ?? {};
      return {
        mint: info.mint as string,
        amount: Number(ta.uiAmountString ?? ta.uiAmount ?? 0),
        decimals: Number(ta.decimals ?? 0),
      } as ParsedToken;
    });
  } catch {
    return [];
  }
}

function validSolAddress(address: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

async function fetchJupiterPrices(mints: string[]): Promise<Map<string, PriceInfo>> {
  const prices = new Map<string, PriceInfo>();
  const unique = [...new Set(mints)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 50) {
    const ids = unique.slice(i, i + 50).join(",");
    try {
      const j = await fetchJson<Record<string, PriceInfo>>(
        `${JUPITER_PRICE_API}?ids=${encodeURIComponent(ids)}`,
        { next: { revalidate: 30 } },
        4_500,
      );
      for (const [mint, price] of Object.entries(j ?? {})) prices.set(mint, price);
    } catch {
      /* Pricing is best-effort. Unknown or thin-liquidity tokens still render without USD value. */
    }
  }
  return prices;
}

function jupiterHeaders() {
  const headers: Record<string, string> = { accept: "application/json" };
  if (JUPITER_API_KEY) headers["x-api-key"] = JUPITER_API_KEY;
  return headers;
}

async function fetchJupiterTokenInfo(mints: string[]): Promise<Map<string, JupiterTokenInfo>> {
  const out = new Map<string, JupiterTokenInfo>();
  const unique = [...new Set(mints)].filter(Boolean).slice(0, MAX_METADATA_LOOKUPS);

  for (let i = 0; i < unique.length; i += 15) {
    const batch = unique.slice(i, i + 15);
    await Promise.allSettled(batch.map(async (mint) => {
      const matches = await fetchJson<JupiterTokenInfo[]>(
        `${JUPITER_TOKEN_API}?query=${encodeURIComponent(mint)}`,
        { headers: jupiterHeaders(), next: { revalidate: 300 } },
        1_800,
      );
      const exact = matches.find((t) => t.id === mint) ?? matches[0];
      if (exact) out.set(mint, exact);
    }));
  }

  return out;
}

/**
 * GET /api/wallet/tokens?address=<sol-address>
 *
 * Returns SPL token balances for the address. Used for the "Audius wallet"
 * chip — Audius issues each user a custodial SPL wallet (`spl_wallet`) that
 * holds their $AUDIO + any Artist Token balances. It generally has 0 native
 * SOL, so `getBalance` was always returning 0; we want token balances.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  if (!validSolAddress(address)) {
    return NextResponse.json({ error: "invalid Solana address" }, { status: 400 });
  }
  const mode = req.nextUrl.searchParams.get("mode") === "full" ? "full" : "summary";

  let coinMap: Map<string, any> = new Map();
  let songMap: Map<string, any> = new Map();
  try {
    const j = await fetchJson<{ data?: any[] }>(
      `https://api.audius.co/v1/coins?app_name=songdaq&limit=100`,
      { next: { revalidate: 60 } },
      5_000,
    ).catch(() => null);
    for (const c of j?.data ?? []) coinMap.set(c.mint, c);
  } catch { /* ignore */ }

  if (mode === "summary") {
    const audioAccounts = await fetchMintAccounts(address, AUDIO_MINT);
    const audioAmount = audioAccounts.reduce((sum, token) => sum + token.amount, 0);
    const audioCoin = coinMap.get(AUDIO_MINT);
    const [priceMap, metaMap, localRates] = await Promise.all([
      fetchJupiterPrices([AUDIO_MINT]),
      fetchJupiterTokenInfo([AUDIO_MINT]),
      getAssetUsdRates(["AUDIO"]),
    ]);
    const audioMeta = metaMap.get(AUDIO_MINT);
    const audioJupiter = priceMap.get(AUDIO_MINT);
    const audioPrice = [audioCoin?.price, audioJupiter?.usdPrice, audioJupiter?.price, localRates.AUDIO]
      .map((value) => Number(value || 0))
      .find((value) => value > 0) ?? 0;
    const audioToken = audioAmount > 0 ? [{
      mint: AUDIO_MINT,
      amount: audioAmount,
      decimals: audioMeta?.decimals ?? 8,
      ticker: audioMeta?.symbol ?? "AUDIO",
      name: audioMeta?.name ?? "Audius",
      logo_uri: audioCoin?.logo_uri ?? audioMeta?.icon ?? `/api/token-image/${AUDIO_MINT}`,
      price: audioPrice || null,
      valueUsd: audioPrice ? audioPrice * audioAmount : null,
      countedValueUsd: audioPrice ? audioPrice * audioAmount : null,
      issuerAllocation: false,
      isAudio: true,
      isArtistCoin: !!audioCoin,
      priceSource: Number(audioCoin?.price || 0) > 0
        ? "audius"
        : Number(audioJupiter?.usdPrice ?? audioJupiter?.price ?? 0) > 0
          ? "jupiter"
          : audioPrice > 0
            ? "estimated"
            : null,
      isVerified: audioMeta?.isVerified ?? true,
      metadataSource: audioMeta ? "jupiter" : "audius",
    }] : [];
    return NextResponse.json({
      address,
      mode,
      tokens: audioToken,
      totalUsd: audioToken.reduce((s, t) => s + (t.countedValueUsd ?? t.valueUsd ?? 0), 0),
      audioBalance: audioAmount,
      artistCoinCount: 0,
    });
  }

  // Full mode is intentionally only used when the wallet detail panel opens.
  // Some public wallets contain thousands of token accounts; keep the response
  // bounded so header polling cannot destabilize Render.
  const [classic, t22] = await Promise.all([
    fetchTokenAccounts(address, SPL_TOKEN_PROGRAM),
    fetchTokenAccounts(address, TOKEN_2022_PROGRAM),
  ]);
  const all = [...classic, ...t22]
    .filter((t) => t.amount > 0)
    .slice(0, MAX_FULL_TOKENS);
  const mints = all.map((t) => t.mint);
  const [priceMap, metaMap] = await Promise.all([
    fetchJupiterPrices(mints),
    fetchJupiterTokenInfo(mints),
  ]);
  if (hasProductionDatabaseUrl()) try {
    const localSongs = await prisma.songToken.findMany({
      where: { mintAddress: { in: mints } },
      select: {
        mintAddress: true,
        symbol: true,
        coinName: true,
        title: true,
        artworkUrl: true,
        price: true,
        currentPriceUsd: true,
        launchPriceUsd: true,
        currentPriceSol: true,
        launchPriceSol: true,
        status: true,
        liquidityPairAmount: true,
        liquidityTokenAmount: true,
        liquidityPairAsset: true,
        supply: true,
        circulating: true,
        volume24h: true,
        artistAllocationBps: true,
        artistWallet: {
          select: {
            wallet: true,
          },
        },
        events: {
          where: { kind: "BURN" },
          select: { kind: true, payload: true },
          take: 100,
        },
      },
    });
    for (const song of localSongs) {
      if (song.mintAddress) songMap.set(song.mintAddress, song);
    }
  } catch {
    /* Database metadata is best-effort; Jupiter metadata still renders. */
  }

  const localRates = await getAssetUsdRates(["SOL", "AUDIO", "USDC", ...Array.from(songMap.values()).map((song: any) => song.liquidityPairAsset)]);

  const enriched = all.map((t) => {
    const coin = coinMap.get(t.mint);
    const song = songMap.get(t.mint);
    const isAudio = t.mint === AUDIO_MINT;
    const jupiterPrice = priceMap.get(t.mint);
    const meta = metaMap.get(t.mint);
    const songValuation = song ? valueLocalSongCoin(song, localRates) : null;
    const burnedSupply = song ? getBurnedSupplyFromEvents((song as any).events) : 0;
    const supplyDistribution = song ? calculateSupplyDistribution({
      supply: songValuation?.totalSupply || song.supply,
      circulating: songValuation?.circulatingSupply || song.circulating,
      liquidityTokenAmount: songValuation?.tradableSupply || song.liquidityTokenAmount,
      artistAllocationBps: song.artistAllocationBps,
      burnedSupply,
    }) : null;
    const songPrice = songValuation?.isMarketValueReliable ? Number(songValuation.priceUsd || 0) : 0;
    const price = Number(songPrice || coin?.price || jupiterPrice?.usdPrice || jupiterPrice?.price || (isAudio ? localRates.AUDIO : 0) || 0);
    const valueUsd = price ? price * t.amount : null;
    const isIssuerSongToken = Boolean(song?.artistWallet?.wallet && song.artistWallet.wallet === address);
    const artistAllocationTokens = song
      ? Number(song.supply || 0) * (Number(song.artistAllocationBps || 0) / 10_000)
      : 0;
    const reservedLiquidityTokens = song ? Number(song.liquidityTokenAmount || 0) : 0;
    const issuerAllocation = Boolean(
      isIssuerSongToken &&
      t.amount > 0 &&
      (t.amount >= Math.max(1, artistAllocationTokens * 0.5) || t.amount > reservedLiquidityTokens),
    );
    const countedValueUsd = issuerAllocation ? 0 : valueUsd;
    return {
      mint: t.mint,
      amount: t.amount,
      decimals: meta?.decimals ?? t.decimals,
      ticker: song?.symbol?.replace(/^\$/, "") ?? coin?.ticker ?? meta?.symbol ?? (isAudio ? "AUDIO" : t.mint.slice(0, 4)),
      name: song?.coinName ?? song?.title ?? coin?.name ?? meta?.name ?? (isAudio ? "Audius" : "Unknown Token"),
      logo_uri: song?.artworkUrl ?? coin?.logo_uri ?? meta?.icon ?? `/api/token-image/${t.mint}`,
      price: price || null,
      valueUsd,
      countedValueUsd,
      issuerAllocation,
      valuationNote: issuerAllocation
        ? "Creator-held supply is shown as issuer allocation and is not counted as liquid portfolio cash."
        : songValuation && !songValuation.isMarketValueReliable
          ? songValuation.note
          : null,
      burnedSupply,
      supplyDistribution,
      isAudio,
      isArtistCoin: !!coin || !!song,
      priceChange24h: jupiterPrice?.priceChange24h ?? null,
      priceSource: price
        ? (coin?.price ? "audius" : (jupiterPrice?.usdPrice || jupiterPrice?.price) ? "jupiter" : isAudio ? "estimated" : "local")
        : null,
      isVerified: meta?.isVerified ?? false,
      organicScoreLabel: meta?.organicScoreLabel ?? null,
      tags: meta?.tags ?? [],
      metadataSource: song ? "SONG·DAQ" : coin ? "audius" : meta ? "jupiter" : "wallet",
    };
  });
  enriched.sort((a, b) => (b.countedValueUsd ?? b.valueUsd ?? 0) - (a.countedValueUsd ?? a.valueUsd ?? 0));

  const totalUsd = enriched.reduce((s, t) => s + (t.countedValueUsd ?? t.valueUsd ?? 0), 0);
  const audio = enriched.find((t) => t.isAudio);
  return NextResponse.json({
    address,
    tokens: enriched,
    totalUsd,
    audioBalance: audio?.amount ?? 0,
    artistCoinCount: enriched.filter((t) => t.isArtistCoin).length,
  });
}
