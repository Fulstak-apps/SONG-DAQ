import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  // Prisma schema is PostgreSQL. Use a short-timeout local Postgres URL in
  // development so routes can fail gracefully instead of throwing a schema
  // validation error from an incompatible sqlite file URL.
  process.env.DATABASE_URL = "postgresql://songdaq:songdaq@127.0.0.1:5432/songdaq?connect_timeout=1";
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
