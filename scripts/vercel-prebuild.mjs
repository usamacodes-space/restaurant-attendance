import { spawnSync } from "node:child_process";

/**
 * Run Prisma migrations only in Vercel production deploys by default.
 * Preview deploys skip migrations unless RUN_MIGRATIONS=true is set.
 */
const explicitMigrationRun = String(process.env.RUN_MIGRATIONS || "").toLowerCase() === "true";
const isVercelProduction =
  process.env.VERCEL === "1" && String(process.env.VERCEL_ENV || "").toLowerCase() === "production";
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
