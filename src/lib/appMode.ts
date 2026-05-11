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
    !value.includes("localhost") &&
    !isSupabaseDirectDatabaseUrl(value);
}

export function isPostgresDatabaseUrl(value = process.env.DATABASE_URL || "") {
  return /^postgres(ql)?:\/\//i.test(value);
}

export function isLocalDatabaseUrl(value = process.env.DATABASE_URL || "") {
  return value.includes("127.0.0.1") || value.includes("localhost");
}

export function isSupabaseDirectDatabaseUrl(value = process.env.DATABASE_URL || "") {
  try {
    const url = new URL(value);
    return /^db\.[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) && (url.port === "5432" || url.port === "");
  } catch {
    return false;
  }
}

export function databaseReadiness(value = process.env.DATABASE_URL || "") {
  if (!value) {
    return {
      configured: false,
      productionReady: false,
      warning: "DATABASE_URL is missing.",
      recommendation: "Set DATABASE_URL to your production Postgres connection string.",
    };
  }
  if (!isPostgresDatabaseUrl(value)) {
    return {
      configured: false,
      productionReady: false,
      warning: "DATABASE_URL is not a Postgres URL.",
      recommendation: "Use a postgres:// or postgresql:// connection string.",
    };
  }
  if (isLocalDatabaseUrl(value)) {
    return {
      configured: true,
      productionReady: false,
      warning: "DATABASE_URL points to a local database.",
      recommendation: "Set Render to the live Supabase or Render Postgres URL before public launch.",
    };
  }
  if (isSupabaseDirectDatabaseUrl(value)) {
    return {
      configured: true,
      productionReady: false,
      warning: "DATABASE_URL points to Supabase direct :5432, which Render may not be able to reach.",
      recommendation: "Use Supabase Transaction Pooler/Session Pooler connection string on Render instead of db.<project>.supabase.co:5432.",
    };
  }
  return {
    configured: true,
    productionReady: true,
    warning: null,
    recommendation: null,
  };
}

export function fakeTransactionId(prefix = "paper") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
