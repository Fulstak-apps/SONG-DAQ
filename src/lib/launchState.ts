export type LaunchStatus =
  | "DRAFT"
  | "PENDING_WALLET_SIGNATURE"
  | "CREATING_TOKEN"
  | "PENDING_LIQUIDITY"
  | "VERIFYING_LIQUIDITY"
  | "LIVE"
  | "FAILED"
  | "RESTRICTED"
  | "DELISTED";

export type LiquidityInput = {
  tokenAmount: number;
  pairAmount: number;
  lockDays: number;
  pairAsset?: string;
  liquidityTxSig?: string | null;
  poolId?: string | null;
};

export function validateLaunchLiquidity(input: LiquidityInput) {
  const tokenAmount = Number(input.tokenAmount);
  const pairAmount = Number(input.pairAmount);
  const lockDays = Number(input.lockDays);
  const pairAsset = String(input.pairAsset || "SOL").toUpperCase();
  const errors: string[] = [];

  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) errors.push("Token amount going into liquidity is required.");
  if (!Number.isFinite(pairAmount) || pairAmount <= 0) errors.push("Paired asset amount is required.");
  if (!Number.isFinite(lockDays) || lockDays < 30) errors.push("Liquidity lockup must be at least 30 days.");
  if (pairAsset !== "SOL" && pairAsset !== "USDC") errors.push("Paired asset must be SOL or USDC.");

  return {
    ok: errors.length === 0,
    errors,
    tokenAmount,
    pairAmount,
    lockDays,
    pairAsset,
  };
}

export function calculateLiquidityHealth(input: LiquidityInput) {
  const v = validateLaunchLiquidity(input);
  if (!v.ok) return 0;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        45 +
          Math.min(v.pairAmount * 20, 30) +
          Math.min(v.tokenAmount / 5000, 15) +
          Math.min(v.lockDays / 6, 10),
      ),
    ),
  );
}

export function riskLevelForLiquidity(health: number) {
  if (health >= 70) return "LOW";
  if (health >= 45) return "MEDIUM";
  return "HIGH";
}

export function canMarkLive(input: LiquidityInput & { confirmed: boolean }) {
  const v = validateLaunchLiquidity(input);
  const errors = [...v.errors];
  if (!input.liquidityTxSig) errors.push("Confirmed liquidity transaction signature is required.");
  if (!input.poolId) errors.push("Liquidity pool address is required.");
  if (!input.confirmed) errors.push("Liquidity transaction must be confirmed on Solana.");
  return {
    ok: errors.length === 0,
    errors,
    health: calculateLiquidityHealth(input),
  };
}
