import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
// $AUDIO on Solana (Wormhole-wrapped)
const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";

interface ParsedToken {
  mint: string;
  amount: number;
  decimals: number;
}

async function fetchTokenAccounts(owner: string, programId: string): Promise<ParsedToken[]> {
  try {
    const r = await fetch(RPC, {
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
    });
    if (!r.ok) return [];
    const j = await r.json();
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

/**
 * GET /api/wallet/tokens?address=<sol-address>
 *
 * Returns SPL token balances for the address. Used for the "Audius wallet"
 * chip — Audius issues each user a custodial SPL wallet (`spl_wallet`) that
 * holds their $AUDIO + any Artist Coin balances. It generally has 0 native
 * SOL, so `getBalance` was always returning 0; we want token balances.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  // Fetch from both classic and Token-2022 programs in parallel; many Audius
  // artist coins use Token-2022 with transfer hooks.
  const [classic, t22] = await Promise.all([
    fetchTokenAccounts(address, SPL_TOKEN_PROGRAM),
    fetchTokenAccounts(address, TOKEN_2022_PROGRAM),
  ]);
  const all = [...classic, ...t22].filter((t) => t.amount > 0);

  // Pull AudiusCoin metadata so the UI can render tickers + logos.
  let coinMap: Map<string, any> = new Map();
  try {
    const r = await fetch(`https://api.audius.co/v1/coins?app_name=songdaq&limit=100`, {
      next: { revalidate: 60 },
    });
    if (r.ok) {
      const j = await r.json();
      for (const c of j.data ?? []) coinMap.set(c.mint, c);
    }
  } catch { /* ignore */ }

  const enriched = all.map((t) => {
    const coin = coinMap.get(t.mint);
    const isAudio = t.mint === AUDIO_MINT;
    return {
      mint: t.mint,
      amount: t.amount,
      decimals: t.decimals,
      ticker: coin?.ticker ?? (isAudio ? "AUDIO" : t.mint.slice(0, 4)),
      name: coin?.name ?? (isAudio ? "Audius" : "Token"),
      logo_uri: coin?.logo_uri ?? null,
      price: coin?.price ?? null,
      valueUsd: coin?.price ? coin.price * t.amount : null,
      isAudio,
      isArtistCoin: !!coin,
    };
  });
  enriched.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  const totalUsd = enriched.reduce((s, t) => s + (t.valueUsd ?? 0), 0);
  const audio = enriched.find((t) => t.isAudio);
  return NextResponse.json({
    address,
    tokens: enriched,
    totalUsd,
    audioBalance: audio?.amount ?? 0,
    artistCoinCount: enriched.filter((t) => t.isArtistCoin).length,
  });
}
