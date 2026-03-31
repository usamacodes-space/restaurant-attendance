import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/index.js";
import fs from "fs";
import path from "path";
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = parseEnvFile(fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8"));

const prisma = new PrismaClient();

async function upsertUser(email, password, role, companyId = null) {
  const hash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash: hash, role, companyId, isActive: true },
    create: { email: email.toLowerCase(), passwordHash: hash, role, companyId, isActive: true },
  });
}

async function main() {
  const masterEmail = (env.ADMIN_EMAIL || "master@waqt.local").toLowerCase();
  const masterPassword = env.ADMIN_PASSWORD || "ChangeMe123!";

  const master = await upsertUser(masterEmail, masterPassword, "MASTER_ADMIN", null);

  const company = await prisma.company.upsert({
    where: { name: "Demo Restaurant" },
    update: {},
    create: { name: "Demo Restaurant" },
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_name: { companyId: company.id, name: "Main Branch" } },
    update: { radiusMeters: 100 },
    create: { companyId: company.id, name: "Main Branch", radiusMeters: 100 },
  });

  const companyAdmin = await upsertUser("admin@demo.local", "Admin123!", "COMPANY_ADMIN", company.id);
  const employeeUser = await upsertUser("employee@demo.local", "Employee123!", "EMPLOYEE", company.id);

  await prisma.employee.upsert({
    where: { userId: employeeUser.id },
    update: {
      companyId: company.id,
      branchId: branch.id,
      name: "Demo Employee",
      nameNormalized: "demo employee",
      employeeCode: "EMP001",
      isActive: true,
    },
    create: {
      userId: employeeUser.id,
      companyId: company.id,
      branchId: branch.id,
      name: "Demo Employee",
      nameNormalized: "demo employee",
      employeeCode: "EMP001",
      isActive: true,
    },
  });

  console.log("Seed complete");
  console.log("Master Admin:", master.email, "password from .env ADMIN_PASSWORD");
  console.log("Company Admin:", companyAdmin.email, "password: Admin123!");
  console.log("Employee:", employeeUser.email, "password: Employee123!");
  console.log("Company:", company.name, "| Branch:", branch.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
