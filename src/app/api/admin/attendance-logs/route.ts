import { NextRequest, NextResponse } from "next/server";
import {
  attendanceLogInclude,
  buildAttendanceLogsWhere,
  normalizeAttendanceLogRows,
  toAttendanceExportRow,
} from "@/lib/attendance-logs-data";
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

  const where = buildAttendanceLogsWhere(
    user.role === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "MASTER_ADMIN",
    user.companyId,
    { from, to, branchId, employeeId }
  );

  const rows = await prisma.attendance.findMany({
    where,
    include: attendanceLogInclude,
    orderBy: { checkInAt: "desc" },
  });

  const normalized = normalizeAttendanceLogRows(rows);
  const exportRows = normalized.map(toAttendanceExportRow);

  if (format === "csv") {
    const fields = Object.keys(exportRows[0] ?? { id: "" });
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, "\"\"")}"`;
      }
      return s;
    };
    const csv = [
      fields.join(","),
      ...exportRows.map((r) => fields.map((f) => escape(r[f as keyof typeof r])).join(",")),
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="attendance.csv"',
      },
    });
  }

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
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
