/**
 * Reads NEON_KEY from .env, creates a Neon project + DB "attendance",
 * writes DATABASE_URL into .env (replaces existing DATABASE_URL line).
 * Run from repo root: node scripts/provision-neon.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

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

function setEnvKey(content, key, value) {
  const lines = content.split(/\r?\n/);
  const prefix = `${key}=`;
  let found = false;
  const escaped = value.includes(" ") || value.includes("#") ? `"${value.replace(/"/g, '\\"')}"` : value;
  const next = lines.map((line) => {
    const t = line.trim();
    if (t.startsWith("#")) return line;
    if (t.startsWith(prefix)) {
      found = true;
      return `${key}=${escaped}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${escaped}`);
  return next.join("\n").replace(/\n*$/, "\n");
}

async function neonFetch(apiKey, pathname, options = {}) {
  const url = `https://console.neon.tech/api/v2${pathname}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = json?.message || json?.error || text || res.statusText;
    throw new Error(`Neon API ${pathname} ${res.status}: ${msg}`);
  }
  return json;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForProjectReady(apiKey, projectId, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await neonFetch(apiKey, `/projects/${projectId}/operations?limit=50`);
    const ops = data.operations ?? [];
    if (ops.length === 0) {
      await sleep(1500);
      continue;
    }
    const busy = ops.some(
      (o) => o.status === "running" || o.status === "scheduling" || o.status === "cancelling"
    );
    if (!busy) return;
    await sleep(2000);
  }
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env — copy .env.example to .env first.");
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const env = parseEnvFile(envContent);
  const apiKey = env.NEON_KEY || env.NEON_API_KEY;
  if (!apiKey) {
    console.error("Add NEON_KEY (or NEON_API_KEY) to .env with your Neon API key.");
    process.exit(1);
  }

  const projectName = `restaurant-attendance-${Date.now().toString(36)}`;

  let orgId = env.NEON_ORG_ID?.trim();
  if (!orgId) {
    try {
      const orgsRes = await neonFetch(apiKey, "/users/me/organizations");
      const orgs = orgsRes.organizations ?? [];
      if (orgs.length === 1) orgId = orgs[0].id;
      else if (orgs.length > 1) {
        console.error(
          "Multiple Neon organizations found. Set NEON_ORG_ID in .env to one of:",
          orgs.map((o) => o.id).join(", ")
        );
        process.exit(1);
      }
    } catch {
      /* personal account — no org */
    }
  }

  const body = {
    project: {
      name: projectName,
      region_id: "aws-us-east-1",
      pg_version: 16,
      branch: {
        name: "main",
        database_name: "attendance",
      },
      ...(orgId ? { org_id: orgId } : {}),
    },
  };

  console.log("Creating Neon project…");
  const created = await neonFetch(apiKey, "/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const projectId = created.project?.id;
  if (!projectId) throw new Error("No project id in response");

  await waitForProjectReady(apiKey, projectId);

  const uris = created.connection_uris ?? [];
  let connectionUri = uris[0]?.connection_uri;
  if (!connectionUri) {
    const branchId = created.branch?.id;
    const roleName = created.roles?.[0]?.name || "attendance_owner";
    const dbName = "attendance";
    if (!branchId) {
      throw new Error("Could not resolve branch id; check Neon console for this project.");
    }
    const qs = new URLSearchParams({
      database_name: dbName,
      role_name: roleName,
      branch_id: branchId,
    });
    const uriRes = await neonFetch(apiKey, `/projects/${projectId}/connection_uri?${qs}`);
    connectionUri = uriRes.uri;
  }

  if (!connectionUri) throw new Error("No connection URI from Neon");

  if (!/[?&]sslmode=/.test(connectionUri)) {
    connectionUri += (connectionUri.includes("?") ? "&" : "?") + "sslmode=require";
  }

  const nextContent = setEnvKey(envContent, "DATABASE_URL", connectionUri);
  fs.writeFileSync(envPath, nextContent, "utf8");
  console.log("Updated DATABASE_URL in .env");
  console.log("Neon project:", projectName, "id:", projectId);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
