import type { Prisma } from "@/generated/prisma";

export const attendanceLogInclude = {
  employee: { select: { id: true, name: true, employeeCode: true } },
  branch: { select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true } },
  company: { select: { id: true, name: true } },
} as const;

export type AttendanceLogDbRow = Prisma.AttendanceGetPayload<{ include: typeof attendanceLogInclude }>;

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildAttendanceLogsWhere(
  role: "MASTER_ADMIN" | "COMPANY_ADMIN",
  userCompanyId: string | null | undefined,
  params: { from?: string | null; to?: string | null; branchId?: string | null; employeeId?: string | null }
): Prisma.AttendanceWhereInput {
  const { from, to, branchId, employeeId } = params;
  const where: Prisma.AttendanceWhereInput = {};

  if (role === "COMPANY_ADMIN" && userCompanyId) {
    where.companyId = userCompanyId;
  }
  if (branchId?.trim()) where.branchId = branchId.trim();
  if (employeeId?.trim()) where.employeeId = employeeId.trim();
  if (from || to) {
    where.checkInAt = {};
    if (from) where.checkInAt.gte = new Date(from);
    if (to) where.checkInAt.lte = new Date(to + "T23:59:59.999Z");
  }
  return where;
}

export function normalizeAttendanceLogRows(rows: AttendanceLogDbRow[]) {
  return rows.map((r) => {
    let locationStatus = "Unknown";
    let distanceMeters: number | "" = "";
    if (r.branch.latitude == null || r.branch.longitude == null) {
      locationStatus = "No branch geofence";
    } else if (r.checkInLatitude == null || r.checkInLongitude == null) {
      locationStatus = "No employee location";
    } else {
      const d = haversineMeters(r.checkInLatitude, r.checkInLongitude, r.branch.latitude, r.branch.longitude);
      distanceMeters = Math.round(d);
      locationStatus = d <= r.branch.radiusMeters ? "Matched" : "Outside branch radius";
    }

    const effectiveCheckInAt = r.countedCheckInAt ?? r.checkInAt;
    const hours =
      r.checkOutAt != null && r.checkOutAt.getTime() > effectiveCheckInAt.getTime()
        ? Math.round(((r.checkOutAt.getTime() - effectiveCheckInAt.getTime()) / 3_600_000) * 100) / 100
        : null;

    const deductionHours = Math.round(Math.max(0, Number(r.deductionHours ?? 0)) * 100) / 100;
    const cappedDeduction = hours != null ? Math.min(deductionHours, hours) : deductionHours;
    const netHours = hours != null ? Math.max(0, Math.round((hours - cappedDeduction) * 100) / 100) : null;

    const overtimeHours = Math.round(Math.max(0, Number(r.overtimeHours ?? 0)) * 100) / 100;
    const totalHours = netHours != null ? Math.round((netHours + overtimeHours) * 100) / 100 : null;

    return {
      id: r.id,
      company: r.company.name,
      branch: r.branch.name,
      employeeName: r.employee.name,
      employeeCode: r.employee.employeeCode ?? "",
      checkInAt: r.checkInAt.toISOString(),
      checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : "",
      hours,
      deductionHours,
      netHours,
      overtimeHours,
      totalHours,
      checkInLatitude: r.checkInLatitude ?? "",
      checkInLongitude: r.checkInLongitude ?? "",
      checkOutLatitude: r.checkOutLatitude ?? "",
      checkOutLongitude: r.checkOutLongitude ?? "",
      checkInSelfieUrl: r.checkInSelfieUrl ?? "",
      checkOutSelfieUrl: r.checkOutSelfieUrl ?? "",
      locationStatus,
      distanceMeters,
      branchRadiusMeters: r.branch.radiusMeters,
    };
  });
}

export type NormalizedAttendanceLogRow = ReturnType<typeof normalizeAttendanceLogRows>[number];

/** Same columns as CSV / Excel export (no selfie URLs). */
export function toAttendanceExportRow(row: NormalizedAttendanceLogRow) {
  const rest = { ...row };
  delete rest.checkInSelfieUrl;
  delete rest.checkOutSelfieUrl;
  return rest;
}

export const attendanceExportColumnOrder = [
  "id",
  "company",
  "branch",
  "employeeName",
  "employeeCode",
  "checkInAt",
  "checkOutAt",
  "hours",
  "deductionHours",
  "netHours",
  "overtimeHours",
  "totalHours",
  "checkInLatitude",
  "checkInLongitude",
  "checkOutLatitude",
  "checkOutLongitude",
  "locationStatus",
  "distanceMeters",
  "branchRadiusMeters",
] as const satisfies readonly (keyof ReturnType<typeof toAttendanceExportRow>)[];
