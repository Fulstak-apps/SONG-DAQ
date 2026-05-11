import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 && !options.allowFailure) process.exit(result.status ?? 1);
  return result;
}

function firstMigrationName() {
  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  return readdirSync(migrationsDir)
    .filter((name) => !name.endsWith(".toml") && !name.startsWith("."))
    .sort()[0];
}

function deployMigrations() {
  const result = run("npx", ["prisma", "migrate", "deploy"], { allowFailure: true });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status === 0) return;

  const isRenderBuild = process.env.RENDER === "true" || Boolean(process.env.RENDER_SERVICE_ID);
  const isReachabilityFailure =
    output.includes("P1001") ||
    output.includes("P1002") ||
    output.includes("Can't reach database server");

  if (isReachabilityFailure || isRenderBuild) {
    console.warn("\nPrisma could not reach the database during Render build.");
    console.warn("Continuing the build so the service can deploy; check DATABASE_URL at runtime.");
    console.warn("For Supabase on Render, use the Supabase connection pooler URL if direct :5432 is unreachable.");
    return;
  }

  if (!output.includes("P3005")) {
    process.exit(result.status ?? 1);
  }

  const baseline = firstMigrationName();
  if (!baseline) {
    console.error("Prisma reported P3005, but no migration folder exists to baseline.");
    process.exit(result.status ?? 1);
  }

  console.warn(`\nPrisma P3005: existing non-empty database detected. Baselining ${baseline} as already applied.`);
  run("npx", ["prisma", "migrate", "resolve", "--applied", baseline]);
  run("npx", ["prisma", "migrate", "deploy"]);
}

const databaseUrl = process.env.DATABASE_URL || "";
const hasPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);

run("npx", ["prisma", "generate"]);

if (hasPostgres) {
  deployMigrations();
} else {
  console.warn("\nSkipping Prisma migrate deploy because DATABASE_URL is not a Postgres URL.");
  console.warn("Render should attach song-daq-db for production persistence.");
}

run("npm", ["run", "build"]);
