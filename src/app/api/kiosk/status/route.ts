import { getValidKioskSessionByPlainToken } from "@/lib/kiosk-session";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { token?: string; employeeId?: string; branchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim();
  const employeeId = body.employeeId?.trim();
  const branchId = body.branchId?.trim();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }
  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
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
      branchId: true,
      companyId: true,
      branch: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (employee.companyId !== kiosk.branch.companyId || employee.branchId !== branch.id) {
    return NextResponse.json({ error: "Employee does not belong to selected branch" }, { status: 400 });
  }

  const open = await prisma.attendance.findFirst({
    where: { employeeId, branchId: branch.id, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  return NextResponse.json({
    employee: {
      id: employee.id,
      name: employee.name,
      role: "EMPLOYEE",
      companyName: employee.company.name,
      branchName: employee.branch.name,
    },
    branch,
    hasOpenShift: !!open,
    openAttendanceId: open?.id ?? null,
    checkInAt: open?.checkInAt.toISOString() ?? null,
  });
}
