import { getValidKioskSessionByPlainToken } from "@/lib/kiosk-session";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  const branchIdParam = req.nextUrl.searchParams.get("branchId")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const kiosk = await getValidKioskSessionByPlainToken(token);
  if (!kiosk) {
    return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
  }

  const branches = await prisma.branch.findMany({
    where: { companyId: kiosk.branch.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const selectedBranchId =
    branchIdParam && branches.some((b) => b.id === branchIdParam) ? branchIdParam : kiosk.branch.id;

  const company = await prisma.company.findUnique({
    where: { id: kiosk.branch.companyId },
    select: { id: true, name: true },
  });

  const employees = await prisma.employee.findMany({
    where: {
      companyId: kiosk.branch.companyId,
      branchId: selectedBranchId,
      isActive: true,
      user: { isActive: true },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      branch: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    company: company ?? { id: kiosk.branch.companyId, name: "" },
    branches,
    selectedBranchId,
    tokenBranchId: kiosk.branch.id,
    tokenValid: true,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      employeeCode: e.employeeCode,
      role: "EMPLOYEE",
      branch: e.branch,
      company: e.company,
    })),
  });
}
