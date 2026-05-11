import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";

function validSolAddress(address: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function rpcLabel(rpc: string) {
  try {
    return new URL(rpc).host;
  } catch {
    return "custom-rpc";
  }
}

async function solUsd() {
  try {
    const data = await fetchJson<Record<string, { usdPrice?: number; price?: number }>>(
      `${JUPITER_PRICE_API}?ids=${SOL_MINT}`,
      { next: { revalidate: 30 } },
      4_000,
    );
    const jup = Number(data?.[SOL_MINT]?.usdPrice ?? data?.[SOL_MINT]?.price ?? 0);
    if (jup > 0) return jup;
  } catch {}
  try {
    const data = await fetchJson<{ solana?: { usd?: number } }>(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } },
      3_500,
    );
    return Number(data?.solana?.usd ?? 0);
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") || "";
  if (!validSolAddress(address)) {
    return NextResponse.json({ error: "valid address required" }, { status: 400 });
  }

  try {
    const data = await fetchJson<{
      result?: { value?: number };
      error?: { message?: string };
    }>(
      RPC,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "songdaq-balance",
          method: "getBalance",
          params: [address, { commitment: "confirmed" }],
        }),
      },
      5_000,
    );

    if (data?.error) {
      return NextResponse.json(
        { error: data.error.message || "Solana RPC error", details: data.error },
        { status: 502 },
      );
    }

    const lamports = Number(data?.result?.value ?? 0);
    const sol = lamports / 1_000_000_000;
    const priceUsd = await solUsd();

    return NextResponse.json({
      address,
      network: NETWORK,
      rpc: rpcLabel(RPC),
      lamports,
      sol,
      priceUsd,
      usd: sol * priceUsd,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load SOL balance" },
      { status: 502 },
    );
  }
}
