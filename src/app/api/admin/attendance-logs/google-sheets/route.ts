import { NextRequest, NextResponse } from "next/server";
import {
  attendanceLogInclude,
  buildAttendanceLogsWhere,
  normalizeAttendanceLogRows,
} from "@/lib/attendance-logs-data";
import { parseSpreadsheetId, replaceAttendanceSheetTab } from "@/lib/google-sheets";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;
  const user = required.user;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const branchId = req.nextUrl.searchParams.get("branchId")?.trim();
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  const companyIdParam = req.nextUrl.searchParams.get("companyId")?.trim();

  let companyId: string | null = null;
  if (user.role === "COMPANY_ADMIN") {
    companyId = user.companyId ?? null;
  } else {
    companyId = companyIdParam ?? null;
  }

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId is required (master admin must pass the target company)" },
      { status: 400 }
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      attendanceGoogleSpreadsheetId: true,
      attendanceGoogleSheetTabName: true,
    },
  });

  const rawId = company?.attendanceGoogleSpreadsheetId?.trim();
  const spreadsheetId = rawId ? parseSpreadsheetId(rawId) : null;
  if (!company || !spreadsheetId) {
    return NextResponse.json(
      { error: "Set the Google Spreadsheet ID for this company in Workspace → Google Sheets" },
      { status: 400 }
    );
  }

  const tabName = company.attendanceGoogleSheetTabName?.trim() || "Attendance";

  if (user.role === "COMPANY_ADMIN" && user.companyId !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildAttendanceLogsWhere(
    user.role === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "MASTER_ADMIN",
    user.companyId,
    { from, to, branchId, employeeId }
  );
  where.companyId = companyId;

  const dbRows = await prisma.attendance.findMany({
    where,
    include: attendanceLogInclude,
    orderBy: { checkInAt: "desc" },
  });

  const normalized = normalizeAttendanceLogRows(dbRows);

  try {
    await replaceAttendanceSheetTab(spreadsheetId, tabName, normalized);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Google Sheets request failed";
    const stack = e instanceof Error ? e.stack : "";
    console.error("[google-sheets]", msg, stack);
    return NextResponse.json(
      {
        error: msg,
        hint:
          "Share the spreadsheet with the service account email from GOOGLE_SERVICE_ACCOUNT_JSON (Editor).",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, rowCount: normalized.length, tabName });
}
