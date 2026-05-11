/**
 * Solana helpers — RPC client + (devnet) SPL mint creation.
 *
 * Server-side mint creation is gated on SOLANA_PAYER_SECRET (a base58
 * secret key for the configured Solana cluster wallet that pays rent /
 * mint creation fees). If it is missing, launch fails loudly instead of
 * creating an off-chain placeholder.
 */

import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import bs58 from "bs58";

export const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as
  | "devnet"
  | "testnet"
  | "mainnet-beta";

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(NETWORK);

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, "confirmed");
  return connection;
}

function loadPayer(): Keypair | null {
  const secret = process.env.SOLANA_PAYER_SECRET;
  if (!secret) return null;
  try {
    const bytes = bs58.decode(secret);
    return Keypair.fromSecretKey(bytes);
  } catch {
    return null;
  }
}

/** Create an SPL mint for a song and optionally mint initial supply to the artist wallet. */
export async function createSongMint({
  decimals = 6,
  owner,
  supply = 0,
  treasury,
  treasurySupply = 0,
}: {
  decimals?: number;
  owner?: string;
  supply?: number;
  treasury?: string;
  treasurySupply?: number;
} = {}): Promise<{ mint: string; tokenAccount?: string; treasuryTokenAccount?: string; mintTx?: string; treasuryMintTx?: string }> {
  const payer = loadPayer();
  if (!payer) {
    throw new Error("SOLANA_PAYER_SECRET is required to create a real SPL mint");
  }
  const conn = getConnection();
  const mint = await createMint(conn, payer, payer.publicKey, payer.publicKey, decimals);
  if ((!owner || supply <= 0) && (!treasury || treasurySupply <= 0)) return { mint: mint.toBase58() };

  let tokenAccount: string | undefined;
  let treasuryTokenAccount: string | undefined;
  let mintTx: string | undefined;
  let treasuryMintTx: string | undefined;
  if (owner && supply > 0) {
    const ownerKey = new PublicKey(owner);
    const ata = await getOrCreateAssociatedTokenAccount(conn, payer, mint, ownerKey);
    const rawSupply = BigInt(Math.trunc(supply)) * 10n ** BigInt(decimals);
    mintTx = await mintTo(conn, payer, mint, ata.address, payer, rawSupply);
    tokenAccount = ata.address.toBase58();
  }
  if (treasury && treasurySupply > 0) {
    const treasuryKey = new PublicKey(treasury);
    const ata = await getOrCreateAssociatedTokenAccount(conn, payer, mint, treasuryKey, true);
    const rawSupply = BigInt(Math.trunc(treasurySupply)) * 10n ** BigInt(decimals);
    treasuryMintTx = await mintTo(conn, payer, mint, ata.address, payer, rawSupply);
    treasuryTokenAccount = ata.address.toBase58();
  }
  return { mint: mint.toBase58(), tokenAccount, treasuryTokenAccount, mintTx, treasuryMintTx };
}

export function shortAddr(addr: string, take = 4): string {
  if (!addr) return "";
  if (addr.length <= take * 2 + 1) return addr;
  return `${addr.slice(0, take)}…${addr.slice(-take)}`;
}

export function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}
