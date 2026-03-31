import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const where =
    required.user.role === "MASTER_ADMIN" ? {} : { id: required.user.companyId ?? undefined };

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { branches: true, employees: true } },
      users: {
        where: { role: "COMPANY_ADMIN" },
        select: { email: true },
        take: 1,
      },
    },
  });

  const normalized = companies.map((c) => ({
    ...c,
    companyAdminEmail: c.users?.[0]?.email ?? null,
  }));

  return NextResponse.json({ companies: normalized });
}

export async function POST(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  let body: { name?: string; adminEmail?: string; adminPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const adminEmail = body.adminEmail?.trim().toLowerCase();
    const adminPassword = body.adminPassword ?? "";
    const company = await prisma.$transaction(async (tx) => {
      const c = await tx.company.create({ data: { name } });
      if (adminEmail && adminPassword.length >= 6) {
        await tx.user.create({
          data: {
            email: adminEmail,
            passwordHash: await bcrypt.hash(adminPassword, 10),
            role: "COMPANY_ADMIN",
            companyId: c.id,
          },
        });
      }
      return c;
    });
    return NextResponse.json({ company });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") return NextResponse.json({ error: "Company already exists" }, { status: 409 });
    throw e;
  }
}
