import { getValidKioskSessionByPlainToken } from "@/lib/kiosk-session";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  let body: { token?: string; employeeId?: string; branchId?: string; passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim();
  const employeeId = body.employeeId?.trim();
  const branchId = body.branchId?.trim();
  const passcode = body.passcode ?? "";
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }
  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }
  if (passcode.length < 1) {
    return NextResponse.json({ error: "passcode required" }, { status: 400 });
  }

  const kiosk = await getValidKioskSessionByPlainToken(token);
  if (!kiosk) {
    return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, companyId: true, company: { select: { id: true, name: true } } },
  });
  if (!branch || branch.companyId !== kiosk.branch.companyId) {
    return NextResponse.json({ error: "Invalid branch for this QR" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      role: true,
      branchId: true,
      companyId: true,
      branch: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      user: { select: { passwordHash: true } },
    },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (employee.companyId !== kiosk.branch.companyId || employee.branchId !== branch.id) {
    return NextResponse.json({ error: "Employee does not belong to selected branch" }, { status: 400 });
  }
  const ok = await bcrypt.compare(passcode, employee.user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }

  const open = await prisma.attendance.findFirst({
    where: { employeeId, branchId: branch.id, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  return NextResponse.json({
    employee: {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      companyName: employee.company.name,
      branchName: employee.branch.name,
    },
    branch,
    hasOpenShift: !!open,
    openAttendanceId: open?.id ?? null,
    checkInAt: open?.checkInAt.toISOString() ?? null,
  });
}
