import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const required = await requireRoles(["EMPLOYEE"]);
  if (!("user" in required)) return required.error;

  const employeeId = required.user.employeeId;
  if (!employeeId) return NextResponse.json({ error: "Employee profile missing" }, { status: 400 });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { branch: { select: { id: true, name: true } }, company: { select: { id: true, name: true } } },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  return NextResponse.json({
    employee: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      branch: employee.branch,
      company: employee.company,
    },
  });
}
