import { requireRoles } from "@/lib/authz";
import { getValidKioskSessionByPlainToken } from "@/lib/kiosk-session";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const required = await requireRoles(["EMPLOYEE"]);
  if (!("user" in required)) return required.error;

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const kiosk = await getValidKioskSessionByPlainToken(token);
  if (!kiosk) {
    return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
  }

  const employeeId = required.user.employeeId;
  if (!employeeId) {
    return NextResponse.json({ error: "Employee profile missing" }, { status: 400 });
  }

  if (required.user.companyId && kiosk.branch.companyId !== required.user.companyId) {
    return NextResponse.json({ error: "This QR belongs to a different company" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const open = await prisma.attendance.findFirst({
    where: { employeeId, branchId: kiosk.branch.id, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  return NextResponse.json({
    employee: { id: employee.id, name: employee.name },
    branch: kiosk.branch,
    hasOpenShift: !!open,
    openAttendanceId: open?.id ?? null,
    checkInAt: open?.checkInAt.toISOString() ?? null,
  });
}
