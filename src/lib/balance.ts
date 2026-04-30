"use client";

/**
 * Lightweight wallet balance helpers. Solana balance comes from a public RPC
 * via @solana/web3.js; EVM balance comes from the connected provider.
 */

const SOL_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";

export async function getSolBalance(address: string): Promise<number> {
  const res = await fetch(SOL_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    }),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const j = await res.json();
  const lamports = j?.result?.value ?? 0;
  return lamports / 1e9;
}

export async function getEvmBalance(address: string): Promise<number> {
  const eth = (globalThis as any).ethereum;
  if (!eth?.request) throw new Error("No EVM provider");
  const hex = await eth.request({ method: "eth_getBalance", params: [address, "latest"] });
  return Number(BigInt(hex)) / 1e18;
}

export async function getSolPriceUsd(): Promise<number> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } as any },
    );
    const j = await r.json();
    return j?.solana?.usd ?? 0;
  } catch {
    return 0;
  }
}
