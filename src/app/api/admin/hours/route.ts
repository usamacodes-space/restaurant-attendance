import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseYearMonth, utcMonthRange, utcWeekRangeContaining } from "@/lib/time-ranges";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

const ALL_BRANCHES = "all";

function safeFilenamePart(s: string) {
  return s.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").slice(0, 80);
}

export async function GET(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const mode = req.nextUrl.searchParams.get("mode") ?? "week";
  const branchParam = req.nextUrl.searchParams.get("branchId")?.trim() ?? "";
  const companyWide = branchParam === "" || branchParam.toLowerCase() === ALL_BRANCHES;
  const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

  let branchFilterId: string | null = null;
  let scopedBranchName: string | null = null;
  if (!companyWide) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchParam },
      select: { id: true, companyId: true, name: true },
    });
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }
    if (required.user.role === "COMPANY_ADMIN" && branch.companyId !== required.user.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    branchFilterId = branch.id;
    scopedBranchName = branch.name;
  }

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

  const isMaster = required.user.role === "MASTER_ADMIN";
  const companyId = required.user.companyId ?? "";

  // Only count the portion of each shift that overlaps [start, end). Hours are based on
  // countedCheckInAt (opening-time grace adjusted) when present, otherwise checkInAt.
  const rows = companyWide
    ? await prisma.$queryRaw<{
        id: string;
        name: string;
        branchName: string;
        regularHours: unknown;
        overtimeHours: unknown;
        totalHours: unknown;
      }[]>`
      SELECT e.id, e.name, b.name AS "branchName",
        COALESCE(
          SUM(
            GREATEST(
              0,
              (
                EXTRACT(
                  EPOCH FROM (
                    LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                  )
                )
                - COALESCE(a."deductionHours", 0) * 3600.0
                  * CASE
                      WHEN EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt"))) > 0
                      THEN EXTRACT(
                        EPOCH FROM (
                          LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                        )
                      ) / EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt")))
                      ELSE 0::double precision
                    END
              )
            )
          ) / 3600.0,
          0
        )::float AS "regularHours",
        COALESCE(
          SUM(
            GREATEST(
              0,
              COALESCE(a."overtimeHours", 0) * 3600.0
                * CASE
                    WHEN EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt"))) > 0
                    THEN EXTRACT(
                      EPOCH FROM (
                        LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                      )
                    ) / EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt")))
                    ELSE 0::double precision
                  END
            )
          ) / 3600.0,
          0
        )::float AS "overtimeHours",
        (
          COALESCE(
            SUM(
              GREATEST(
                0,
                (
                  EXTRACT(
                    EPOCH FROM (
                      LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                    )
                  )
                  - COALESCE(a."deductionHours", 0) * 3600.0
                    * CASE
                        WHEN EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt"))) > 0
                        THEN EXTRACT(
                          EPOCH FROM (
                            LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                          )
                        ) / EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt")))
                        ELSE 0::double precision
                      END
                  + COALESCE(a."overtimeHours", 0) * 3600.0
                    * CASE
                        WHEN EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt"))) > 0
                        THEN EXTRACT(
                          EPOCH FROM (
                            LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                          )
                        ) / EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt")))
                        ELSE 0::double precision
                      END
                )
              )
            ) / 3600.0,
            0
          )
        )::float AS "totalHours"
      FROM "Employee" e
      INNER JOIN "Branch" b ON b.id = e."branchId"
      LEFT JOIN "Attendance" a
        ON a."employeeId" = e.id
        AND a."checkOutAt" IS NOT NULL
        AND a."checkOutAt" > ${start}
        AND COALESCE(a."countedCheckInAt", a."checkInAt") < ${end}
        AND (${isMaster} OR a."companyId" = ${companyId})
      WHERE (${isMaster} OR e."companyId" = ${companyId})
      GROUP BY e.id, e.name, b.name
      ORDER BY b.name ASC, e.name ASC
    `
    : await prisma.$queryRaw<{
        id: string;
        name: string;
        regularHours: unknown;
        overtimeHours: unknown;
        totalHours: unknown;
      }[]>`
      SELECT e.id, e.name,
        COALESCE(
          SUM(
            GREATEST(
              0,
              (
                EXTRACT(
                  EPOCH FROM (
                    LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                  )
                )
                - COALESCE(a."deductionHours", 0) * 3600.0
                  * CASE
                      WHEN EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt"))) > 0
                      THEN EXTRACT(
                        EPOCH FROM (
                          LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                        )
                      ) / EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt")))
                      ELSE 0::double precision
                    END
              )
            )
          ) / 3600.0,
          0
        )::float AS "regularHours",
        COALESCE(
          SUM(
            GREATEST(
              0,
              COALESCE(a."overtimeHours", 0) * 3600.0
                * CASE
                    WHEN EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt"))) > 0
                    THEN EXTRACT(
                      EPOCH FROM (
                        LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                      )
                    ) / EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt")))
                    ELSE 0::double precision
                  END
            )
          ) / 3600.0,
          0
        )::float AS "overtimeHours",
        (
          COALESCE(
            SUM(
              GREATEST(
                0,
                (
                  EXTRACT(
                    EPOCH FROM (
                      LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                    )
                  )
                  - COALESCE(a."deductionHours", 0) * 3600.0
                    * CASE
                        WHEN EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt"))) > 0
                        THEN EXTRACT(
                          EPOCH FROM (
                            LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                          )
                        ) / EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt")))
                        ELSE 0::double precision
                      END
                  + COALESCE(a."overtimeHours", 0) * 3600.0
                    * CASE
                        WHEN EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt"))) > 0
                        THEN EXTRACT(
                          EPOCH FROM (
                            LEAST(a."checkOutAt", ${end}) - GREATEST(COALESCE(a."countedCheckInAt", a."checkInAt"), ${start})
                          )
                        ) / EXTRACT(EPOCH FROM (a."checkOutAt" - COALESCE(a."countedCheckInAt", a."checkInAt")))
                        ELSE 0::double precision
                      END
                )
              )
            ) / 3600.0,
            0
          )
        )::float AS "totalHours"
      FROM "Employee" e
      LEFT JOIN "Attendance" a
        ON a."employeeId" = e.id
        AND a."checkOutAt" IS NOT NULL
        AND a."checkOutAt" > ${start}
        AND COALESCE(a."countedCheckInAt", a."checkInAt") < ${end}
        AND a."branchId" = ${branchFilterId!}
        AND (${isMaster} OR a."companyId" = ${companyId})
      WHERE (${isMaster} OR e."companyId" = ${companyId})
        AND e."branchId" = ${branchFilterId!}
      GROUP BY e.id, e.name
      ORDER BY e.name ASC
    `;

  const mappedRows = rows.map((r) => ({
    employeeId: r.id,
    name: r.name,
    regularHours: Math.round(Number(r.regularHours) * 100) / 100,
    overtimeHours: Math.round(Number(r.overtimeHours) * 100) / 100,
    totalHours: Math.round(Number(r.totalHours) * 100) / 100,
    ...("branchName" in r && r.branchName != null ? { branchName: r.branchName } : {}),
  }));

  if (format === "csv" || format === "xlsx") {
    const scopeLabel = companyWide ? "All branches (company)" : `Branch: ${scopedBranchName ?? ""}`;
    const exportRows = mappedRows.map((r) => ({
      Period: label,
      "Range start (UTC)": start.toISOString(),
      "Range end (UTC)": end.toISOString(),
      Mode: mode,
      Scope: scopeLabel,
      Employee: r.name,
      "Home branch": companyWide ? (r.branchName ?? "") : (scopedBranchName ?? ""),
      "Regular hours": r.regularHours,
      "Overtime hours": r.overtimeHours,
      "Total hours": r.totalHours,
    }));

    const baseName = `work-hours_${safeFilenamePart(label)}_${companyWide ? "company" : safeFilenamePart(scopedBranchName ?? "branch")}`;

    if (format === "csv") {
      const fields = [
        "Period",
        "Range start (UTC)",
        "Range end (UTC)",
        "Mode",
        "Scope",
        "Employee",
        "Home branch",
        "Regular hours",
        "Overtime hours",
        "Total hours",
      ] as const;
      const escape = (v: unknown) => {
        const s = String(v ?? "");
        if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
          return `"${s.replace(/"/g, "\"\"")}"`;
        }
        return s;
      };
      const csv = [
        fields.join(","),
        ...exportRows.map((row) => fields.map((f) => escape(row[f])).join(",")),
      ].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        },
      });
    }

    const worksheet =
      exportRows.length > 0
        ? XLSX.utils.json_to_sheet(exportRows)
        : XLSX.utils.aoa_to_sheet([
            [
              "Period",
              "Range start (UTC)",
              "Range end (UTC)",
              "Mode",
              "Scope",
              "Employee",
              "Home branch",
              "Regular hours",
              "Overtime hours",
              "Total hours",
            ],
          ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "work hours");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    });
  }

  return NextResponse.json({
    mode,
    label,
    scope: companyWide ? "company" : "branch",
    branchId: companyWide ? null : branchFilterId,
    range: { start: start.toISOString(), end: end.toISOString() },
    rows: mappedRows,
  });
}
