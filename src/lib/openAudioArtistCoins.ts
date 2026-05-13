import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, clusterApiUrl } from "@solana/web3.js";
import BN from "bn.js";

export const AUDIO_MINT = new PublicKey("9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM");
export const OPEN_AUDIO_ARTIST_SUPPLY = 1_000_000_000;
export const OPEN_AUDIO_ARTIST_DECIMALS = 9;
export const OPEN_AUDIO_INITIAL_MARKET_CAP_AUDIO = 100_000;
export const OPEN_AUDIO_GRADUATION_MARKET_CAP_AUDIO = 1_000_000;
export const OPEN_AUDIO_ARTIST_VESTING_BPS = 5000;
export const OPEN_AUDIO_PUBLIC_CURVE_BPS = 2500;
export const OPEN_AUDIO_LOCKED_AMM_LIQUIDITY_BPS = 2000;
export const OPEN_AUDIO_REWARD_POOL_BPS = 500;

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function getOpenAudioArtistCoinConfig() {
  return process.env.OPEN_AUDIO_ARTIST_COIN_CONFIG || process.env.NEXT_PUBLIC_OPEN_AUDIO_ARTIST_COIN_CONFIG || "";
}

export function openAudioArtistCoinReadiness() {
  const config = getOpenAudioArtistCoinConfig();
  return {
    configured: Boolean(config),
    config,
    missing: config ? [] : ["OPEN_AUDIO_ARTIST_COIN_CONFIG"],
    summary: "Open Audio Artist Coins use Meteora Dynamic Bonding Curve, $AUDIO quote mint, 1B supply, 9 decimals, and 50% creator vesting.",
  };
}

export function sanitizeArtistCoinSymbol(input: string) {
  return input.replace(/^\$/, "").replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase() || "ARTIST";
}

export function sanitizeArtistCoinName(input: string) {
  const clean = input.replace(/\s+/g, " ").trim();
  return (clean ? `${clean} Coin` : "Artist Coin").slice(0, 32);
}

export function createLaunchMemo(symbol: string) {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(
      `SONG·DAQ Open Audio Artist Coin: $${sanitizeArtistCoinSymbol(symbol)}. AUDIO-paired Meteora bonding curve, 1B supply, 9 decimals, 50% artist vesting.`,
      "utf8",
    ),
  });
}

export async function buildOpenAudioArtistCoinLaunchTransaction({
  creatorWallet,
  name,
  symbol,
  metadataUri,
  initialBuyAmountAudio = 0,
}: {
  creatorWallet: string;
  name: string;
  symbol: string;
  metadataUri: string;
  initialBuyAmountAudio?: number;
}) {
  const readiness = openAudioArtistCoinReadiness();
  if (!readiness.configured) {
    throw new Error("OPEN_AUDIO_ARTIST_COIN_CONFIG is required before SONG·DAQ can launch official AUDIO-paired Artist Coins.");
  }

  const [{ DynamicBondingCurveClient, deriveDbcPoolAddress }, { default: BNModule }] = await Promise.all([
    import("@meteora-ag/dynamic-bonding-curve-sdk"),
    import("bn.js"),
  ]);

  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta");
  const connection = new Connection(rpc, "confirmed");
  const dbcClient = DynamicBondingCurveClient.create(connection, "confirmed");
  const creator = new PublicKey(creatorWallet);
  const config = new PublicKey(readiness.config);
  const mintKeypair = Keypair.generate();
  const safeName = sanitizeArtistCoinName(name);
  const safeSymbol = sanitizeArtistCoinSymbol(symbol);
  const audioRaw = Math.max(0, Math.trunc(Number(initialBuyAmountAudio || 0) * 10 ** OPEN_AUDIO_ARTIST_DECIMALS));

  const tx = await dbcClient.pool.createPoolWithFirstBuy({
    createPoolParam: {
      config,
      name: safeName,
      symbol: safeSymbol,
      uri: metadataUri,
      poolCreator: creator,
      baseMint: mintKeypair.publicKey,
      payer: creator,
    },
    firstBuyParam: audioRaw > 0
      ? {
          buyer: creator,
          buyAmount: new BNModule(audioRaw),
          minimumAmountOut: new BNModule(0),
          referralTokenAccount: null,
        }
      : undefined,
  });

  tx.feePayer = creator;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  tx.instructions.unshift(createLaunchMemo(safeSymbol));
  tx.partialSign(mintKeypair);

  const poolAddress = deriveDbcPoolAddress(AUDIO_MINT, mintKeypair.publicKey, config);
  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    mint: mintKeypair.publicKey.toBase58(),
    poolAddress: poolAddress.toBase58(),
    config: config.toBase58(),
    quoteMint: AUDIO_MINT.toBase58(),
    name: safeName,
    symbol: safeSymbol,
    metadataUri,
    latestBlockhash: latest.blockhash,
  };
}

