import { prisma } from "@/lib/prisma";
import { parseEmployeeShiftFields } from "@/lib/employee-shift-input";
import { requireRoles } from "@/lib/authz";
import { normalizeEmployeeName } from "@/lib/normalize-name";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import type { EmployeeRole } from "@/generated/prisma";

export async function GET() {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const where =
    required.user.role === "MASTER_ADMIN" ? {} : { companyId: required.user.companyId ?? undefined };

  const employees = await prisma.employee.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      branch: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, isActive: true } },
    },
  });

  return NextResponse.json({ employees });
}

export async function POST(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  let body: {
    name?: string;
    notes?: string | null;
    email?: string;
    password?: string;
    branchId?: string;
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

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const branchId = body.branchId?.trim();
  const role: EmployeeRole = body.role ?? "OTHER";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (!branchId) {
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });
  }

  const nameNormalized = normalizeEmployeeName(name);
  if (!nameNormalized) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }
  if (required.user.role === "COMPANY_ADMIN" && required.user.companyId !== branch.companyId) {
    return NextResponse.json({ error: "Forbidden branch" }, { status: 403 });
  }

  const companyId = branch.companyId;
  const passwordHash = await bcrypt.hash(password, 10);

  const shift = parseEmployeeShiftFields({
    shiftStartTime: body.shiftStartTime,
    shiftEndTime: body.shiftEndTime,
  });
  if ("error" in shift) {
    return NextResponse.json({ error: shift.error }, { status: 400 });
  }

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "EMPLOYEE",
          companyId,
        },
      });
      return tx.employee.create({
        data: {
          userId: user.id,
          companyId,
          branchId,
          name,
          nameNormalized,
          notes: body.notes?.trim() || null,
          employeeCode: body.employeeCode?.trim() || null,
          role,
          shiftStartTime: shift.shiftStartTime,
          shiftEndTime: shift.shiftEndTime,
        },
        include: {
          user: { select: { id: true, email: true, isActive: true } },
          branch: { select: { id: true, name: true } },
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
