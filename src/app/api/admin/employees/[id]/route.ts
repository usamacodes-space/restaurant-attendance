import { prisma } from "@/lib/prisma";
import { parseEmployeeShiftFields } from "@/lib/employee-shift-input";
import { requireRoles } from "@/lib/authz";
import { normalizeEmployeeName } from "@/lib/normalize-name";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import type { EmployeeRole } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;

  let body: {
    name?: string;
    notes?: string | null;
    email?: string;
    password?: string;
    branchId?: string;
    isActive?: boolean;
    employeeCode?: string | null;
    role?: EmployeeRole;
    shiftStartTime?: string | null;
    shiftEndTime?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (required.user.role === "COMPANY_ADMIN" && existing.companyId !== required.user.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const name = body.name?.trim();
  const data: {
    name?: string;
    nameNormalized?: string;
    notes?: string | null;
    branchId?: string;
    employeeCode?: string | null;
    isActive?: boolean;
    role?: EmployeeRole;
    shiftStartTime?: string | null;
    shiftEndTime?: string | null;
  } = {};
  if (name !== undefined) {
    if (!name) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    const nameNormalized = normalizeEmployeeName(name);
    if (!nameNormalized) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    data.name = name;
    data.nameNormalized = nameNormalized;
  }
  if (body.notes !== undefined) {
    data.notes = body.notes?.trim() || null;
  }
  if (body.employeeCode !== undefined) {
    data.employeeCode = body.employeeCode?.trim() || null;
  }
  if (body.branchId !== undefined) {
    const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    if (required.user.role === "COMPANY_ADMIN" && branch.companyId !== required.user.companyId) {
      return NextResponse.json({ error: "Forbidden branch" }, { status: 403 });
    }
    data.branchId = branch.id;
  }
  if (body.isActive !== undefined) {
    data.isActive = !!body.isActive;
  }
  if (body.role !== undefined) {
    data.role = body.role;
  }
  if (body.shiftStartTime !== undefined || body.shiftEndTime !== undefined) {
    const shift = parseEmployeeShiftFields({
      shiftStartTime:
        body.shiftStartTime !== undefined ? body.shiftStartTime : existing.shiftStartTime,
      shiftEndTime: body.shiftEndTime !== undefined ? body.shiftEndTime : existing.shiftEndTime,
    });
    if ("error" in shift) {
      return NextResponse.json({ error: shift.error }, { status: 400 });
    }
    data.shiftStartTime = shift.shiftStartTime;
    data.shiftEndTime = shift.shiftEndTime;
  }

  const userData: { email?: string; passwordHash?: string; isActive?: boolean } = {};
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email cannot be empty" }, { status: 400 });
    userData.email = email;
  }
  if (body.password !== undefined) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    userData.passwordHash = await bcrypt.hash(body.password, 10);
  }
  if (body.isActive !== undefined) {
    userData.isActive = !!body.isActive;
  }

  if (Object.keys(data).length === 0 && Object.keys(userData).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    const employee = await prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: existing.userId },
          data: userData,
        });
      }
      return tx.employee.update({
        where: { id },
        data,
        include: {
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, isActive: true } },
        },
      });
    });
    return NextResponse.json({ employee });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "Duplicate email, employee name, or employee code" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;

  try {
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.user.delete({ where: { id: existing.userId } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
