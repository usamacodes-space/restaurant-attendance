import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, utcMonthRange, utcWeekRangeContaining } from "@/lib/time-ranges";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const mode = req.nextUrl.searchParams.get("mode") ?? "week";
  const branchId = req.nextUrl.searchParams.get("branchId")?.trim() ?? "";
  const now = new Date();

  let start: Date;
  let end: Date;
  let label: string;

  if (mode === "month") {
    const ym = req.nextUrl.searchParams.get("month");
    if (ym) {
      const parsed = parseYearMonth(ym);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid month (use YYYY-MM)" }, { status: 400 });
      }
      const r = utcMonthRange(parsed.year, parsed.monthIndex0);
      start = r.start;
      end = r.end;
      label = ym;
    } else {
      const r = utcMonthRange(now.getUTCFullYear(), now.getUTCMonth());
      start = r.start;
      end = r.end;
      label = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    }
  } else {
    const anchor = req.nextUrl.searchParams.get("week");
    const d = anchor ? new Date(anchor + (anchor.length === 10 ? "T12:00:00.000Z" : "")) : now;
    if (anchor && Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid week anchor date" }, { status: 400 });
    }
    const r = utcWeekRangeContaining(Number.isNaN(d.getTime()) ? now : d);
    start = r.start;
    end = r.end;
    label = start.toISOString().slice(0, 10);
  }

  const rows = await prisma.$queryRaw<{ id: string; name: string; hours: unknown }[]>`
    SELECT e.id, e.name,
      COALESCE(
        SUM(EXTRACT(EPOCH FROM (a."checkOutAt" - a."checkInAt"))) / 3600.0,
        0
      )::float AS hours
    FROM "Employee" e
    LEFT JOIN "Attendance" a
      ON a."employeeId" = e.id
      AND a."checkOutAt" IS NOT NULL
      AND a."checkInAt" >= ${start}
      AND a."checkInAt" < ${end}
      AND (${branchId} = '' OR a."branchId" = ${branchId})
      AND (${required.user.role === "MASTER_ADMIN"} OR a."companyId" = ${required.user.companyId ?? ""})
    WHERE (${required.user.role === "MASTER_ADMIN"} OR e."companyId" = ${required.user.companyId ?? ""})
    GROUP BY e.id, e.name
    ORDER BY e.name ASC
  `;

  return NextResponse.json({
    mode,
    label,
    range: { start: start.toISOString(), end: end.toISOString() },
    rows: rows.map((r) => ({
      employeeId: r.id,
      name: r.name,
      hours: Math.round(Number(r.hours) * 100) / 100,
    })),
  });
}
