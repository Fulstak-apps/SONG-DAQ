/**
 * Solana helpers — RPC client + (devnet) SPL mint creation.
 *
 * Server-side mint creation is gated on SOLANA_PAYER_SECRET (a base58
 * secret key for a devnet wallet that pays rent / mint creation fees).
 * Without it the API still works but stores a deterministic mock mint
 * address so the UI flow stays consistent.
 */

import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
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

/** Create an SPL mint for a song. Returns the mint pubkey. */
export async function createSongMint(decimals = 6): Promise<{ mint: string; mock: boolean }> {
  const payer = loadPayer();
  if (!payer) {
    // Deterministic mock mint so UI / DB is consistent in dev.
    const fake = Keypair.generate().publicKey.toBase58();
    return { mint: fake, mock: true };
  }
  const conn = getConnection();
  const mint = await createMint(conn, payer, payer.publicKey, payer.publicKey, decimals);
  return { mint: mint.toBase58(), mock: false };
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
