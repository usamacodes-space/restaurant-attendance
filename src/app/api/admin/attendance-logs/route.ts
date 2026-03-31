import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;
  const user = required.user!;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const branchId = req.nextUrl.searchParams.get("branchId")?.trim();
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

  const where: {
    companyId?: string;
    branchId?: string;
    employeeId?: string;
    checkInAt?: { gte?: Date; lte?: Date };
  } = {};

  if (user.role === "COMPANY_ADMIN" && user.companyId) {
    where.companyId = user.companyId;
  }
  if (branchId) where.branchId = branchId;
  if (employeeId) where.employeeId = employeeId;
  if (from || to) {
    where.checkInAt = {};
    if (from) where.checkInAt.gte = new Date(from);
    if (to) where.checkInAt.lte = new Date(to + "T23:59:59.999Z");
  }

  const rows = await prisma.attendance.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, employeeCode: true } },
      branch: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { checkInAt: "desc" },
  });

  const normalized = rows.map((r) => ({
    id: r.id,
    company: r.company.name,
    branch: r.branch.name,
    employeeName: r.employee.name,
    employeeCode: r.employee.employeeCode ?? "",
    checkInAt: r.checkInAt.toISOString(),
    checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : "",
    checkInLatitude: r.checkInLatitude ?? "",
    checkInLongitude: r.checkInLongitude ?? "",
    checkOutLatitude: r.checkOutLatitude ?? "",
    checkOutLongitude: r.checkOutLongitude ?? "",
    checkInSelfieUrl: r.checkInSelfieUrl ?? "",
    checkOutSelfieUrl: r.checkOutSelfieUrl ?? "",
  }));

  if (format === "csv") {
    const fields = Object.keys(normalized[0] ?? { id: "" });
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, "\"\"")}"`;
      }
      return s;
    };
    const csv = [fields.join(","), ...normalized.map((r) => fields.map((f) => escape(r[f as keyof typeof r])).join(","))].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="attendance.csv"',
      },
    });
  }

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(normalized);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "attendance");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="attendance.xlsx"',
      },
    });
  }

  return NextResponse.json({ rows: normalized });
}
