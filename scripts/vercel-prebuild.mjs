import { spawnSync } from "node:child_process";

/**
 * Runs Prisma migrations for Vercel production deploys (default),
 * or when explicitly requested with RUN_MIGRATIONS=true.
 *
 * Preview deploys skip migrations by default to avoid failures when
 * preview databases are read-only or intentionally permission-limited.
 */
const explicitMigrationRun = String(process.env.RUN_MIGRATIONS || "").toLowerCase() === "true";
const isVercelProduction = process.env.VERCEL === "1" && String(process.env.VERCEL_ENV || "").toLowerCase() === "production";
const shouldRunMigrations = explicitMigrationRun || isVercelProduction;

if (!shouldRunMigrations) {
  console.log("[prebuild] Skipping prisma migrate deploy (not production and RUN_MIGRATIONS!=true).");
  process.exit(0);
}

console.log("[prebuild] Running prisma migrate deploy...");
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

