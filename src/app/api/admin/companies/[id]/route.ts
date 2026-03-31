import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;
  let body: { name?: string; adminEmail?: string; adminPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const name = body.name?.trim();
    const adminEmail = body.adminEmail?.trim().toLowerCase();
    const adminPassword = body.adminPassword ?? "";

    if (!name && !adminEmail && !adminPassword) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      let company = null;
      if (name) {
        company = await tx.company.update({
          where: { id },
          data: { name },
        });
      } else {
        company = await tx.company.findUnique({ where: { id } });
      }

      const existingAdmin = await tx.user.findFirst({
        where: { companyId: id, role: "COMPANY_ADMIN" },
        select: { id: true },
      });

      // Update or create the company admin user
      if (adminEmail || adminPassword) {
        if (!existingAdmin) {
          if (!adminEmail || adminPassword.length < 6) {
            throw new Error("Missing adminEmail or adminPassword (min 6 chars) for new company admin.");
          }
          await tx.user.create({
            data: {
              email: adminEmail!,
              passwordHash: await bcrypt.hash(adminPassword, 10),
              role: "COMPANY_ADMIN",
              companyId: id,
            },
          });
        } else {
          const data: { email?: string; passwordHash?: string } = {};
          if (adminEmail) {
            data.email = adminEmail;
          }
          if (adminPassword) {
            if (adminPassword.length < 6) {
              throw new Error("adminPassword must be at least 6 characters.");
            }
            data.passwordHash = await bcrypt.hash(adminPassword, 10);
          }
          await tx.user.update({
            where: { id: existingAdmin.id },
            data,
          });
        }
      }

      return { company };
    });

    return NextResponse.json({ company: updated.company });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "Duplicate company name or admin email" }, { status: 409 });
    const msg = e instanceof Error ? e.message : "";
    if (msg) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;
  try {
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

