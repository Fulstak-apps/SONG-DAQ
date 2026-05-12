"use client";

/**
 * Lightweight wallet balance helpers. song-daq settlement is Solana-only.
 */

const SOL_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";

export async function getSolBalance(address: string): Promise<number> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5_000);
  const res = await fetch(SOL_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    }),
    signal: ctrl.signal,
  });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const j = await res.json();
  const lamports = j?.result?.value ?? 0;
  return lamports / 1e9;
}

export async function getSolPriceUsd(): Promise<number> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5_000);
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } as any, signal: ctrl.signal },
    );
    clearTimeout(timeout);
    const j = await r.json();
    return j?.solana?.usd ?? 0;
  } catch {
    return 0;
  }
}
