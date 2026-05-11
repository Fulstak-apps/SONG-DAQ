import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";

const API_KEY = process.env.JUPITER_API_KEY;
const API_BASE = process.env.JUPITER_API_BASE
  || (API_KEY ? "https://api.jup.ag/swap/v1" : "https://lite-api.jup.ag/swap/v1");

function headers() {
  const h: Record<string, string> = { accept: "application/json" };
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

function plainJupiterError(message: string, status: number) {
  const lower = message.toLowerCase();
  if (status === 400 || lower.includes("not tradable") || lower.includes("no routes") || lower.includes("could not find any route")) {
    return "No live swap route is available for this token right now. Try a more liquid token, reduce the amount, or wait until the artist adds more liquidity.";
  }
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return "The live pricing network timed out. Try again in a few seconds.";
  }
  return message || "Jupiter could not price this swap right now.";
}

export async function GET(req: NextRequest) {
  const inputMint = req.nextUrl.searchParams.get("inputMint");
  const outputMint = req.nextUrl.searchParams.get("outputMint");
  const amount = req.nextUrl.searchParams.get("amount");
  const slippageBps = req.nextUrl.searchParams.get("slippageBps") ?? "100";
  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json({ error: "inputMint, outputMint, amount required" }, { status: 400 });
  }
  if (inputMint === outputMint) {
    return NextResponse.json({ error: "Pick two different assets to trade." }, { status: 400 });
  }
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    return NextResponse.json({ error: "Enter an amount greater than zero." }, { status: 400 });
  }

  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps,
    restrictIntermediateTokens: "true",
  });

  let j: any;
  try {
    j = await fetchJson<any>(`${API_BASE}/quote?${qs.toString()}`, {
      headers: headers(),
      cache: "no-store",
    }, 5_000);
  } catch (e: any) {
    const message = e?.message || "Jupiter quote failed";
    return NextResponse.json({ error: plainJupiterError(message, 400), rawError: message }, { status: 503 });
  }
  if (j?.error) return NextResponse.json({ error: plainJupiterError(j.error, 400), rawError: j.error }, { status: 503 });
  return NextResponse.json({ quote: j });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { quoteResponse, userPublicKey } = body ?? {};
  if (!quoteResponse || !userPublicKey) {
    return NextResponse.json({ error: "quoteResponse and userPublicKey required" }, { status: 400 });
  }

  let j: any;
  try {
    j = await fetchJson<any>(`${API_BASE}/swap`, {
      method: "POST",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 1_000_000,
            priorityLevel: "high",
          },
        },
      }),
    }, 7_500);
  } catch (e: any) {
    const message = e?.message || "Jupiter swap build failed";
    return NextResponse.json({ error: plainJupiterError(message, 400), rawError: message }, { status: 503 });
  }
  if (j?.error) return NextResponse.json({ error: plainJupiterError(j.error, 400), rawError: j.error }, { status: 503 });
  return NextResponse.json(j);
}
