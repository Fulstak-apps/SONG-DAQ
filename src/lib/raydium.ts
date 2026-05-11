import BN from "bn.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Raydium, CREATE_CPMM_POOL_FEE_ACC, CREATE_CPMM_POOL_PROGRAM, DEVNET_PROGRAM_ID, TxVersion, getCpmmPdaAmmConfigId } from "@raydium-io/raydium-sdk-v2";
import { NETWORK, RPC_URL } from "@/lib/solana";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const AUDIO_MINT = "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM";

function uiToRaw(amount: number, decimals: number): BN {
  const multiplier = 10n ** BigInt(decimals);
  const parts = String(amount).trim().split(".");
  const whole = BigInt(parts[0] || "0");
  const frac = (parts[1] || "").slice(0, decimals).padEnd(decimals, "0");
  const fractional = BigInt(frac || "0");
  return new BN((whole * multiplier + fractional).toString());
}

export async function buildCpmmLiquidityTransaction(params: {
  owner: string;
  mintAddress: string;
  tokenAmount: number;
  pairAmount: number;
  pairAsset: "SOL" | "USDC" | "AUDIO";
}) {
  const connection = new Connection(RPC_URL, "confirmed");
  const raydium = await Raydium.load({
    connection,
    cluster: (NETWORK === "mainnet-beta" ? "mainnet" : "devnet") as "mainnet" | "devnet",
    owner: new PublicKey(params.owner),
    disableLoadToken: false,
    disableFeatureCheck: false,
  });

  const feeConfigs = await raydium.api.getCpmmConfigs();
  if (!feeConfigs.length) throw new Error("No Raydium CPMM fee configs are available");
  if (raydium.cluster === "devnet") {
    feeConfigs.forEach((config) => {
      config.id = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58();
    });
  }

  const tokenMint = {
    address: params.mintAddress,
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    decimals: 6,
  };
  const pairMint =
    params.pairAsset === "SOL"
      ? { address: SOL_MINT, programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", decimals: 9 }
      : params.pairAsset === "AUDIO"
        ? { address: AUDIO_MINT, programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", decimals: 8 }
        : { address: USDC_MINT, programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", decimals: 6 };

  const mintA = new PublicKey(tokenMint.address);
  const mintB = new PublicKey(pairMint.address);
  const { transaction, extInfo } = await raydium.cpmm.createPool({
    programId: raydium.cluster === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: raydium.cluster === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC : CREATE_CPMM_POOL_FEE_ACC,
    mintA: tokenMint,
    mintB: pairMint,
    mintAAmount: uiToRaw(params.tokenAmount, tokenMint.decimals),
    mintBAmount: uiToRaw(params.pairAmount, pairMint.decimals),
    startTime: new BN(0),
    feeConfig: feeConfigs[0],
    associatedOnly: false,
    ownerInfo: { useSOLBalance: params.pairAsset === "SOL" },
    txVersion: TxVersion.V0,
  });

  const base64Transaction = Buffer.from(transaction.serialize()).toString("base64");

  return {
    base64Transaction,
    poolId: extInfo.address.poolId.toBase58(),
    lpMint: extInfo.address.lpMint.toBase58(),
    vaultA: extInfo.address.vaultA.toBase58(),
    vaultB: extInfo.address.vaultB.toBase58(),
    configId: extInfo.address.configId.toBase58(),
    mintA: mintA.toBase58(),
    mintB: mintB.toBase58(),
  };
}
