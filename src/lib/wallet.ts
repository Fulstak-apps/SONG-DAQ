"use client";

/**
 * Solana wallet detector. Talks to injected providers directly so we
 * stay framework-agnostic while keeping SONG·DAQ settlement Solana-only.
 *
 *   Solana: Phantom, Solflare, Backpack
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export type WalletId = "phantom" | "solflare" | "backpack";

export interface ConnectResult {
  address: string;
  kind: "solana";
  provider: WalletId;
}

type SolanaProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  providers?: SolanaProvider[];
  publicKey?: { toString(): string } | null;
  connect: (options?: Record<string, unknown>) => Promise<{ publicKey?: { toString(): string } } | void>;
  disconnect?: () => Promise<void>;
  signAndSendTransaction?: (tx: Transaction | VersionedTransaction) => Promise<string | { signature: string }>;
  signTransaction?: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signMessage?: (message: Uint8Array, display?: string) => Promise<{ signature?: Uint8Array | number[] }>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  off?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
};

interface SolWindow {
  solana?: SolanaProvider;
  phantom?: { solana?: SolanaProvider };
  solflare?: SolanaProvider;
  backpack?: SolanaProvider | { solana?: SolanaProvider };
}

function w(): SolWindow & Window {
  return globalThis as any;
}

export function getConnectedWalletId(): WalletId | null {
  if (getCurrentWalletAddress("phantom")) return "phantom";
  if (getCurrentWalletAddress("solflare")) return "solflare";
  if (getCurrentWalletAddress("backpack")) return "backpack";
  return null;
}

export interface WalletDescriptor {
  id: WalletId;
  label: string;
  kind: "solana";
  installed: () => boolean;
  installUrl: string;
}

export const WALLETS: WalletDescriptor[] = [
  {
    id: "phantom",
    label: "Phantom",
    kind: "solana",
    installed: () => !!providerFor("phantom"),
    installUrl: "https://phantom.app/download",
  },
  {
    id: "solflare",
    label: "Solflare",
    kind: "solana",
    installed: () => !!providerFor("solflare"),
    installUrl: "https://solflare.com/download",
  },
  {
    id: "backpack",
    label: "Backpack",
    kind: "solana",
    installed: () => !!providerFor("backpack"),
    installUrl: "https://backpack.app/download",
  },
];

function assertValidSolanaAddress(address: string | null | undefined, label: string) {
  if (!address) throw new Error(`${label} did not return a public key`);
  try {
    return new PublicKey(address).toBase58();
  } catch {
    throw new Error(`${label} returned an invalid Solana address`);
  }
}

async function withWalletTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 25_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} did not respond. Unlock the wallet and try again.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function walletLabel(id: WalletId) {
  return WALLETS.find((wallet) => wallet.id === id)?.label || "Wallet";
}

export function requestWalletBalanceRefresh(address?: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("songdaq:wallet-refresh", { detail: { address, ts: Date.now() } }));
}

export function walletDiagnosticsSnapshot() {
  if (typeof window === "undefined") return {};
  const win = w() as any;
  return {
    href: window.location.href,
    userAgent: navigator.userAgent,
    phantom: {
      hasWindowPhantom: !!win.phantom,
      hasPhantomSolana: !!win.phantom?.solana,
      hasPublicKey: !!win.phantom?.solana?.publicKey,
      isPhantom: !!win.phantom?.solana?.isPhantom,
    },
    solana: {
      exists: !!win.solana,
      isPhantom: !!win.solana?.isPhantom,
      isSolflare: !!win.solana?.isSolflare,
      isBackpack: !!win.solana?.isBackpack,
      hasPublicKey: !!win.solana?.publicKey,
      providers: Array.isArray(win.solana?.providers)
        ? win.solana.providers.map((provider: SolanaProvider) => ({
            isPhantom: !!provider?.isPhantom,
            isSolflare: !!provider?.isSolflare,
            isBackpack: !!provider?.isBackpack,
            hasPublicKey: !!provider?.publicKey,
          }))
        : [],
    },
    solflare: {
      exists: !!win.solflare,
      isSolflare: !!win.solflare?.isSolflare,
      hasPublicKey: !!win.solflare?.publicKey,
    },
    backpack: {
      exists: !!win.backpack,
      isBackpack: !!((win.backpack?.solana ?? win.backpack)?.isBackpack),
      hasPublicKey: !!((win.backpack?.solana ?? win.backpack)?.publicKey),
    },
  };
}

export async function reportWalletError(errorType: string, error: unknown, walletId?: WalletId, walletAddress?: string | null) {
  if (typeof window === "undefined") return;
  const message = error instanceof Error ? error.message : String(error || "Unknown wallet error");
  const stack = error instanceof Error ? error.stack : undefined;
  try {
    await fetch("/api/error-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        errorType,
        walletAddress,
        page: window.location.href,
        message: `${walletId ? `${walletId}: ` : ""}${message}`,
        stack: JSON.stringify({ stack, diagnostics: walletDiagnosticsSnapshot() }, null, 2),
      }),
    });
  } catch {
    /* Reporting should never block wallet UX. */
  }
}

function createMemoInstruction(message: string) {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(message.slice(0, 180), "utf8"),
  });
}

export function liveWalletTransactionsAllowed() {
  return true;
}

export function assertLiveWalletTransactionsAllowed() {
  return;
}

function isProviderLike(provider: unknown): provider is SolanaProvider {
  return !!provider && typeof (provider as SolanaProvider).connect === "function";
}

function providerMatches(id: WalletId, provider: unknown): provider is SolanaProvider {
  if (!isProviderLike(provider)) return false;
  if (id === "phantom") return !!provider.isPhantom;
  if (id === "solflare") return !!provider.isSolflare;
  if (id === "backpack") return !!provider.isBackpack;
  return false;
}

function allSolanaCandidates(): SolanaProvider[] {
  const win = w() as any;
  const candidates: unknown[] = [
    win.phantom?.solana,
    win.solflare,
    win.backpack?.solana,
    win.backpack,
    win.solana,
    ...(Array.isArray(win.solana?.providers) ? win.solana.providers : []),
  ];
  return candidates.filter(isProviderLike);
}

async function waitForProvider(id: WalletId, timeoutMs = 3_500): Promise<SolanaProvider | null> {
  const immediate = providerFor(id);
  if (immediate) return immediate;
  if (typeof window === "undefined") return null;

  window.dispatchEvent(new Event("wallet-standard:app-ready"));
  window.dispatchEvent(new Event("solana#initialized"));
  window.dispatchEvent(new Event("phantom#initialized"));

  const startedAt = Date.now();
  return await new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    const finish = (provider: SolanaProvider | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, check));
      resolve(provider);
    };
    const check = () => {
      const provider = providerFor(id);
      if (provider) finish(provider);
      if (Date.now() - startedAt >= timeoutMs) finish(null);
    };
    const events = ["phantom#initialized", "solana#initialized", "wallet-standard:register-wallet", "wallet-standard:app-ready"];
    events.forEach((event) => window.addEventListener(event, check));
    interval = setInterval(check, 150);
    timer = setTimeout(() => finish(null), timeoutMs);
    check();
  });
}

async function connectProvider(provider: SolanaProvider, id: WalletId) {
  const label = walletLabel(id);
  const existing = connectedPublicKey(null, provider);
  if (existing) return { publicKey: { toString: () => existing } };

  try {
    return await withWalletTimeout(provider.connect(), label);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const canRetryWithOptions = id === "phantom" && /argument|option|parameter|unexpected|unsupported/i.test(message);
    if (!canRetryWithOptions) throw error;
    return await withWalletTimeout(provider.connect({ onlyIfTrusted: false }), label);
  }
}

function connectedPublicKey(result: unknown, provider: SolanaProvider) {
  return (result as any)?.publicKey?.toString?.() || provider.publicKey?.toString?.();
}

async function waitForConnectedPublicKey(result: unknown, provider: SolanaProvider, label: string) {
  const immediate = connectedPublicKey(result, provider);
  if (immediate) return immediate;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1_200) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const next = connectedPublicKey(result, provider);
    if (next) return next;
  }
  throw new Error(`${label} approved the connection but did not return a public key. Unlock the wallet, refresh, and try again.`);
}

export async function connectWallet(id: WalletId): Promise<ConnectResult> {
  switch (id) {
    case "phantom": {
      const p = await waitForProvider("phantom");
      if (!p) throw new Error("Phantom was not detected. Make sure the Phantom extension is installed, enabled, and allowed on this site, then refresh.");
      const r = await connectProvider(p, "phantom");
      const publicKey = await waitForConnectedPublicKey(r, p, "Phantom");
      const address = assertValidSolanaAddress(publicKey, "Phantom");
      requestWalletBalanceRefresh(address);
      return { address, kind: "solana", provider: id };
    }
    case "solflare": {
      const p = await waitForProvider("solflare");
      if (!p) throw new Error("Solflare was not detected. Make sure the extension is installed, enabled, and allowed on this site, then refresh.");
      const r = await connectProvider(p, "solflare");
      const address = assertValidSolanaAddress(await waitForConnectedPublicKey(r, p, "Solflare"), "Solflare");
      requestWalletBalanceRefresh(address);
      return { address, kind: "solana", provider: id };
    }
    case "backpack": {
      const p = await waitForProvider("backpack");
      if (!p) throw new Error("Backpack was not detected. Make sure the extension is installed, enabled, and allowed on this site, then refresh.");
      const r = await connectProvider(p, "backpack");
      const publicKey = await waitForConnectedPublicKey(r, p, "Backpack");
      const address = assertValidSolanaAddress(publicKey, "Backpack");
      requestWalletBalanceRefresh(address);
      return { address, kind: "solana", provider: id };
    }
    default:
      throw new Error("Unknown wallet");
  }
}

export async function disconnectWallet(id: WalletId | null): Promise<void> {
  if (!id) return;
  try {
    await providerFor(id)?.disconnect?.();
  } catch {
    /* ignore */
  }
  requestWalletBalanceRefresh();
}

function providerFor(id: WalletId): SolanaProvider | null {
  const win = w();
  if (id === "phantom") {
    const direct = win.phantom?.solana;
    if (isProviderLike(direct)) return direct;
    const match = allSolanaCandidates().find((provider) => providerMatches("phantom", provider));
    if (match) return match;
    return null;
  }
  if (id === "solflare") {
    const solflare = win.solflare;
    if (isProviderLike(solflare) && solflare.isSolflare) return solflare;
    const match = allSolanaCandidates().find((provider) => providerMatches("solflare", provider));
    if (match) return match;
    return null;
  }
  if (id === "backpack") {
    const backpack = win.backpack as any;
    const nested = backpack?.solana ?? backpack;
    if (isProviderLike(nested) && nested.isBackpack) return nested;
    const match = allSolanaCandidates().find((provider) => providerMatches("backpack", provider));
    if (match) return match;
    return null;
  }
  return null;
}

export function getCurrentWalletAddress(id: WalletId): string | null {
  const provider = providerFor(id);
  const raw = provider?.publicKey?.toString?.();
  if (!raw) return null;
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    return null;
  }
}

export function subscribeWalletChanges(
  id: WalletId,
  onAddress: (address: string | null) => void,
): () => void {
  const provider = providerFor(id);
  if (!provider?.on) return () => {};

  const emitCurrent = (value?: any) => {
    const raw = value?.toString?.() || provider.publicKey?.toString?.() || null;
    if (!raw) {
      onAddress(null);
      return;
    }
    try {
      onAddress(new PublicKey(raw).toBase58());
    } catch {
      onAddress(null);
    }
  };
  const onAccountChanged = (publicKey: any) => emitCurrent(publicKey);
  const onConnect = (publicKey: any) => emitCurrent(publicKey);
  const onDisconnect = () => onAddress(null);

  provider.on("accountChanged", onAccountChanged);
  provider.on("connect", onConnect);
  provider.on("disconnect", onDisconnect);

  return () => {
    const off = provider.off || provider.removeListener;
    off?.call(provider, "accountChanged", onAccountChanged);
    off?.call(provider, "connect", onConnect);
    off?.call(provider, "disconnect", onDisconnect);
  };
}

export async function signMessage(id: WalletId, message: string, address: string): Promise<string> {
  const enc = new TextEncoder().encode(message);
  switch (id) {
    case "phantom": {
      const p = providerFor("phantom");
      if (!p) throw new Error("Phantom not found");
      const r = await (p as any).signMessage(enc, "utf8");
      return r.signature ? Buffer.from(r.signature).toString("hex") : "";
    }
    case "solflare": {
      const p = providerFor("solflare");
      if (!p) throw new Error("Solflare not found");
      const r = await (p as any).signMessage(enc, "utf8");
      return r.signature ? Buffer.from(r.signature).toString("hex") : "";
    }
    case "backpack": {
      const p = providerFor("backpack");
      if (!p) throw new Error("Backpack not found");
      const r = await (p as any).signMessage(enc);
      return r.signature ? Buffer.from(r.signature).toString("hex") : "";
    }
    default:
      throw new Error("Unknown wallet");
  }
}

export async function sendSerializedTransaction(id: WalletId, base64Transaction: string): Promise<string> {
  assertLiveWalletTransactionsAllowed();
  const provider = providerFor(id);
  if (!provider) throw new Error("Solana wallet not found");

  const bytes = Uint8Array.from(atob(base64Transaction), (c) => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(bytes);

  if (provider.signAndSendTransaction) {
    const result = await withWalletTimeout(
      provider.signAndSendTransaction(tx),
      `${walletLabel(id)} transaction approval`,
      45_000,
    );
    const sig = typeof result === "string" ? result : result.signature;
    requestWalletBalanceRefresh(provider.publicKey?.toString?.());
    setTimeout(() => requestWalletBalanceRefresh(provider.publicKey?.toString?.()), 6_000);
    return sig;
  }

  if (!provider.signTransaction) {
    throw new Error("Wallet does not support transaction signing");
  }

  const signed = await withWalletTimeout(
    provider.signTransaction(tx),
    `${walletLabel(id)} transaction signing`,
    45_000,
  );
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta");
  const connection = new Connection(rpc, "confirmed");
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(sig, "confirmed").catch(() => {});
  requestWalletBalanceRefresh(provider.publicKey?.toString?.());
  setTimeout(() => requestWalletBalanceRefresh(provider.publicKey?.toString?.()), 6_000);
  return sig;
}

export async function createArtistPaidSongMint(
  id: WalletId,
  {
    artistWallet,
    treasuryWallet,
    artistSupply,
    treasurySupply,
    metadata,
    decimals = 6,
  }: {
    artistWallet: string;
    treasuryWallet: string;
    artistSupply: number;
    treasurySupply: number;
    metadata?: {
      name: string;
      symbol: string;
      baseUrl: string;
    };
    decimals?: number;
  },
): Promise<{ mint: string; tokenAccount: string; treasuryTokenAccount: string; mintTx: string; metadataAddress?: string; metadataUri?: string }> {
  assertLiveWalletTransactionsAllowed();
  const provider = providerFor(id);
  if (!provider) throw new Error("Solana wallet not found");

  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta");
  const connection = new Connection(rpc, "confirmed");
  const payer = new PublicKey(artistWallet);
  const currentWallet = provider.publicKey?.toString?.();
  const currentWalletAddress = currentWallet ? assertValidSolanaAddress(currentWallet, "Connected wallet") : null;
  if (!currentWalletAddress) {
    throw new Error("External wallet is not connected. Reconnect Phantom, Solflare, or Backpack and try launching again.");
  }
  if (currentWalletAddress !== payer.toBase58()) {
    throw new Error(`Connected wallet changed. Reconnect ${payer.toBase58().slice(0, 4)}...${payer.toBase58().slice(-4)} before launching.`);
  }
  const mint = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  const artistAta = await getAssociatedTokenAddress(mint.publicKey, payer);
  const metadataUri = metadata?.baseUrl
    ? `${metadata.baseUrl.replace(/\/$/, "")}/api/token-metadata/${mint.publicKey.toBase58()}`
    : undefined;
  const memoSymbol = metadata?.symbol?.replace(/^\$/, "").trim().slice(0, 10).toUpperCase() || "SONG";
  const metadataInstruction = metadata && metadataUri
    ? createMetadataInstruction({
        mint: mint.publicKey,
        mintAuthority: payer,
        payer,
        updateAuthority: payer,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
      })
    : null;
  const rawArtistSupply = BigInt(Math.trunc(Math.max(0, artistSupply))) * 10n ** BigInt(decimals);
  const rawTreasurySupply = BigInt(Math.trunc(Math.max(0, treasurySupply))) * 10n ** BigInt(decimals);
  const latest = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: latest.blockhash,
  }).add(
    createMemoInstruction(
      `SONG·DAQ launch mint: $${memoSymbol}. Fixed supply song coin, artist wallet receives supply, metadata attached, freeze disabled, mint authority revoked.`,
    ),
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mint.publicKey, decimals, payer, null),
    createAssociatedTokenAccountInstruction(payer, artistAta, payer, mint.publicKey),
  );

  if (metadataInstruction) tx.add(metadataInstruction.instruction);

  if (rawArtistSupply > 0n) {
    tx.add(createMintToInstruction(mint.publicKey, artistAta, payer, rawArtistSupply));
  }

  // Keep the first Phantom approval clean: all newly minted supply goes to the
  // artist wallet, then mint authority is revoked in the same transaction.
  // Liquidity reserve movement happens later through a separate, explicit
  // liquidity action, which avoids looking like a hidden transfer to treasury.
  tx.add(createSetAuthorityInstruction(mint.publicKey, payer, AuthorityType.MintTokens, null));

  tx.partialSign(mint);

  let sig: string;
  if (provider.signAndSendTransaction) {
    const result = await withWalletTimeout(
      provider.signAndSendTransaction(tx),
      `${walletLabel(id)} launch mint approval`,
      45_000,
    );
    sig = typeof result === "string" ? result : result.signature;
  } else if (provider.signTransaction) {
    const signed = await withWalletTimeout(
      provider.signTransaction(tx),
      `${walletLabel(id)} launch mint signing`,
      45_000,
    );
    sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
  } else {
    throw new Error("Wallet does not support transaction signing");
  }

  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  requestWalletBalanceRefresh(artistWallet);
  setTimeout(() => requestWalletBalanceRefresh(artistWallet), 6_000);
  return {
    mint: mint.publicKey.toBase58(),
    tokenAccount: artistAta.toBase58(),
    treasuryTokenAccount: "",
    mintTx: sig,
    metadataAddress: metadataInstruction?.metadata.toBase58(),
    metadataUri,
  };
}

function writeString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, Buffer.from(bytes)]);
}

function createMetadataInstruction({
  mint,
  mintAuthority,
  payer,
  updateAuthority,
  name,
  symbol,
  uri,
}: {
  mint: PublicKey;
  mintAuthority: PublicKey;
  payer: PublicKey;
  updateAuthority: PublicKey;
  name: string;
  symbol: string;
  uri: string;
}) {
  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  const safeName = name.trim().slice(0, 32) || "SONG·DAQ Token";
  const safeSymbol = symbol.replace(/^\$/, "").trim().slice(0, 10).toUpperCase() || "SONG";
  const safeUri = uri.trim().slice(0, 200);

  // Metaplex CreateMetadataAccountV3 instruction. This creates the on-chain
  // pointer wallets and explorers use to identify a mint as a legitimate token.
  const data = Buffer.concat([
    Buffer.from([33]),
    writeString(safeName),
    writeString(safeSymbol),
    writeString(safeUri),
    Buffer.from([0, 0]), // sellerFeeBasisPoints
    Buffer.from([0]), // creators: none
    Buffer.from([0]), // collection: none
    Buffer.from([0]), // uses: none
    Buffer.from([0]), // isMutable
    Buffer.from([0]), // collectionDetails: none
  ]);

  return {
    metadata,
    instruction: new TransactionInstruction({
      programId: TOKEN_METADATA_PROGRAM_ID,
      keys: [
        { pubkey: metadata, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: mintAuthority, isSigner: true, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: updateAuthority, isSigner: true, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    }),
  };
}
