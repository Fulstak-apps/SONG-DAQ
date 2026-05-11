import { prisma } from "./db";

export async function getOrCreateUser(wallet: string, walletType: "solana" = "solana") {
  if (!wallet) throw new Error("wallet required");
  const found = await prisma.user.findUnique({ where: { wallet } });
  if (found) return found;
  return prisma.user.create({ data: { wallet, walletType } });
}
