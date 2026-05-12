import { NextRequest, NextResponse } from "next/server";
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { createBurnInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { prisma } from "@/lib/db";
import { databaseReadiness } from "@/lib/appMode";
import { getConnection, isValidPubkey } from "@/lib/solana";

export const dynamic = "force-dynamic";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const TOKEN_DECIMALS = 6;

function decimalToAtomic(value: string | number, decimals = TOKEN_DECIMALS) {
  const input = String(value ?? "0").trim();
  if (!/^\d+(\.\d+)?$/.test(input)) throw new Error("Invalid burn amount");
  const [wholeRaw, fracRaw = ""] = input.split(".");
  const whole = BigInt(wholeRaw || "0");
  const frac = BigInt(fracRaw.slice(0, decimals).padEnd(decimals, "0") || "0");
  const raw = whole * 10n ** BigInt(decimals) + frac;
  if (raw <= 0n) throw new Error("Burn amount must be greater than 0");
  return raw;
}

function memo(message: string) {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(message.slice(0, 180), "utf8"),
  });
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const database = databaseReadiness();
    if (!database.productionReady) {
      return NextResponse.json(
        { error: "Burn transaction prep needs a reachable production database.", recommendation: database.recommendation },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const wallet = String(body?.wallet || "");
    const amount = body?.amount;
    if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
    if (!isValidPubkey(wallet)) return NextResponse.json({ error: "invalid wallet" }, { status: 422 });

    const song = await prisma.songToken.findFirst({
      where: {
        OR: [{ id: ctx.params.id }, { symbol: ctx.params.id.toUpperCase() }, { audiusTrackId: ctx.params.id }],
      },
      select: { id: true, symbol: true, mintAddress: true },
    });
    if (!song) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!song.mintAddress) return NextResponse.json({ error: "This token does not have an SPL mint yet" }, { status: 422 });

    const owner = new PublicKey(wallet);
    const mint = new PublicKey(song.mintAddress);
    const rawAmount = decimalToAtomic(amount);
    const uiAmount = Number(amount);
    const conn = getConnection();
    const accounts = await conn.getParsedTokenAccountsByOwner(owner, { mint }, "confirmed");
    const source = accounts.value.find((acc) => {
      const tokenAmount = (acc.account.data as any)?.parsed?.info?.tokenAmount;
      const raw = BigInt(tokenAmount?.amount || "0");
      return raw >= rawAmount;
    })?.pubkey;

    if (!source) {
      return NextResponse.json(
        { error: "Your connected wallet does not have enough of this token to burn." },
        { status: 422 },
      );
    }

    const latest = await conn.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: owner,
      recentBlockhash: latest.blockhash,
      instructions: [
        memo(`song-daq burn: permanently destroy ${uiAmount.toLocaleString()} $${song.symbol}.`),
        createBurnInstruction(source, mint, owner, rawAmount, [], TOKEN_PROGRAM_ID),
      ],
    }).compileToV0Message();
    const transaction = new VersionedTransaction(message);

    return NextResponse.json({
      transaction: Buffer.from(transaction.serialize()).toString("base64"),
      sourceTokenAccount: source.toBase58(),
      mint: mint.toBase58(),
      amount: uiAmount,
      rawAmount: rawAmount.toString(),
      message: `Ready for wallet approval. This permanently burns ${uiAmount.toLocaleString()} $${song.symbol} from your connected wallet. It cannot be undone.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to prepare burn transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
