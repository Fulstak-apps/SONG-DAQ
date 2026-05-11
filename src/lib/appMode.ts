export type AppMode = "paper" | "devnet" | "live";

export function appMode(): AppMode {
  const raw = (process.env.APP_MODE || process.env.NEXT_PUBLIC_APP_MODE || "").toLowerCase();
  if (raw === "paper" || raw === "devnet" || raw === "live") return raw;
  if (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta") return "live";
  if (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet") return "devnet";
  return "paper";
}

export function featureEnabled(name: string, fallback = true) {
  const raw = process.env[name] ?? process.env[`NEXT_PUBLIC_${name}`];
  if (raw == null || raw === "") return fallback;
  return !["0", "false", "off", "no"].includes(String(raw).toLowerCase());
}

export const ROYALTY_EMAIL = process.env.NEXT_PUBLIC_ROYALTY_SETUP_EMAIL || "admin@song-daq.com";
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "admin@song-daq.com";

export function hasProductionDatabaseUrl(value = process.env.DATABASE_URL || "") {
  return /^postgres(ql)?:\/\//i.test(value) &&
    !value.includes("127.0.0.1") &&
    !value.includes("localhost");
}

export function fakeTransactionId(prefix = "paper") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
