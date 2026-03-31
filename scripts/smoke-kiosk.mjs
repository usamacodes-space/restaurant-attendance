import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { fileURLToPath } from "url";

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function normalizeEmployeeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function generateKioskPlainToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashKioskToken(plain) {
  return crypto.createHash("sha256").update(plain, "utf8").digest("hex");
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.join(scriptDir, "..");
  const envPath = path.join(repoRoot, ".env");
  const env = parseEnvFile(fs.readFileSync(envPath, "utf8"));
  if (!env.DATABASE_URL) throw new Error("Missing DATABASE_URL in .env");

  // Prisma reads DATABASE_URL from process.env
  process.env.DATABASE_URL = env.DATABASE_URL;

  const prisma = new PrismaClient();
  const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";

  const employeeName = `Smoke Employee ${Date.now()}`;
  const employee = await prisma.employee.create({
    data: {
      name: employeeName,
      nameNormalized: normalizeEmployeeName(employeeName),
    },
  });

  const token = generateKioskPlainToken();
  const kioskSession = await prisma.kioskSession.create({
    data: {
      tokenHash: hashKioskToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  // Create an open shift so check-out endpoint can be exercised without selfie upload.
  const attendance = await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      kioskSessionId: kioskSession.id,
      checkInAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  });

  const statusRes = await fetch(`${baseUrl}/api/kiosk/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, employeeId: employee.id }),
  });
  const statusText = await statusRes.text();
  let statusJson;
  try {
    statusJson = JSON.parse(statusText);
  } catch {
    throw new Error(`Status returned non-JSON: ${statusRes.status} ${statusText.slice(0, 300)}`);
  }
  if (!statusRes.ok) throw new Error(`Status failed: ${statusRes.status} ${JSON.stringify(statusJson)}`);
  if (!statusJson.hasOpenShift) throw new Error("Expected hasOpenShift=true");

  const checkoutRes = await fetch(`${baseUrl}/api/kiosk/check-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, employeeId: employee.id }),
  });
  const checkoutText = await checkoutRes.text();
  let checkoutJson;
  try {
    checkoutJson = JSON.parse(checkoutText);
  } catch {
    throw new Error(`Check-out returned non-JSON: ${checkoutRes.status} ${checkoutText.slice(0, 300)}`);
  }
  if (!checkoutRes.ok) {
    throw new Error(`Check-out failed: ${checkoutRes.status} ${JSON.stringify(checkoutJson)}`);
  }

  const updated = await prisma.attendance.findUnique({ where: { id: attendance.id } });
  if (!updated?.checkOutAt) throw new Error("Expected checkOutAt to be set");

  // Cleanup (best-effort)
  await prisma.employee.delete({ where: { id: employee.id } }).catch(() => {});

  console.log("Smoke kiosk test: OK");
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});

