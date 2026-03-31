/**
 * Reads selected keys from .env and pushes them to Vercel production (overwrites with --force).
 * Run from repo root: node scripts/push-vercel-env.mjs
 */
import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const KEYS = ["DATABASE_URL", "AUTH_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD"];

const envPath = path.join(root, ".env");
const env = parseEnvFile(readFileSync(envPath, "utf8"));

for (const key of KEYS) {
  const value = env[key];
  if (!value) {
    console.warn("Skip (missing):", key);
    continue;
  }
  const args = ["vercel", "env", "add", key, "production", "--value", value, "--yes", "--force"];
  if (key.includes("SECRET") || key.includes("PASSWORD") || key.includes("URL")) {
    args.push("--sensitive");
  }
  const r = spawnSync("npx", args, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    env: { ...process.env },
  });
  if (r.status !== 0) {
    console.error(key, r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  console.log("Set:", key);
}
