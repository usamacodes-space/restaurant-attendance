import { requireRoles } from "@/lib/authz";
import {
  validateBranchOperatingHourInput,
  WEEKDAY_OPTIONS,
  type WeekdayNumber,
} from "@/lib/branch-operating-hours";
import { assertBranchManage } from "@/lib/branch-access";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type DayRow = {
  dayOfWeek: WeekdayNumber;
  label: string;
  openTime: string | null;
  closeTime: string | null;
};

function withMissingDays(days: { dayOfWeek: number; openTime: string | null; closeTime: string | null }[]): DayRow[] {
  const byDay = new Map(days.map((d) => [d.dayOfWeek, d] as const));
  return WEEKDAY_OPTIONS.map((d) => {
    const row = byDay.get(d.dayOfWeek);
    return {
      dayOfWeek: d.dayOfWeek,
      label: d.label,
      openTime: row?.openTime ?? null,
      closeTime: row?.closeTime ?? null,
    };
  });
}

export async function GET(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const branchId = req.nextUrl.searchParams.get("branchId")?.trim() ?? "";
  if (!branchId) return NextResponse.json({ error: "branchId is required" }, { status: 400 });

  const access = await assertBranchManage(required.user, branchId);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const rows = await prisma.branchOperatingHour.findMany({
    where: { branchId },
    select: { dayOfWeek: true, openTime: true, closeTime: true },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ branchId, days: withMissingDays(rows) });
}

export async function PUT(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  let body: {
    branchId?: string;
    days?: { dayOfWeek: number; openTime?: string | null; closeTime?: string | null }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const branchId = body.branchId?.trim() ?? "";
  if (!branchId) return NextResponse.json({ error: "branchId is required" }, { status: 400 });

  const access = await assertBranchManage(required.user, branchId);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const incoming = body.days ?? [];
  if (!Array.isArray(incoming) || !incoming.length) {
    return NextResponse.json({ error: "days array is required" }, { status: 400 });
  }

  const normalized = new Map<WeekdayNumber, { openTime: string | null; closeTime: string | null }>();
  for (const d of incoming) {
    const validated = validateBranchOperatingHourInput(d);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    normalized.set(validated.dayOfWeek, { openTime: validated.openTime, closeTime: validated.closeTime });
  }

  for (const d of WEEKDAY_OPTIONS) {
    if (!normalized.has(d.dayOfWeek)) {
      normalized.set(d.dayOfWeek, { openTime: null, closeTime: null });
    }
  }

  await prisma.$transaction(
    Array.from(normalized.entries()).map(([dayOfWeek, value]) =>
      prisma.branchOperatingHour.upsert({
        where: { branchId_dayOfWeek: { branchId, dayOfWeek } },
        update: { openTime: value.openTime, closeTime: value.closeTime },
        create: { branchId, dayOfWeek, openTime: value.openTime, closeTime: value.closeTime },
      })
    )
  );

  const rows = await prisma.branchOperatingHour.findMany({
    where: { branchId },
    select: { dayOfWeek: true, openTime: true, closeTime: true },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ branchId, days: withMissingDays(rows) });
}
