import { requireRoles } from "@/lib/authz";
import { assertBranchManage } from "@/lib/branch-access";
import { prisma } from "@/lib/prisma";
import { shiftCrossesMidnight, validateShiftTimes } from "@/lib/shift-time";
import { NextRequest, NextResponse } from "next/server";

function serializeShift(s: {
  id: string;
  branchId: string;
  name: string | null;
  startTime: string;
  endTime: string;
  sortOrder: number;
  createdAt: Date;
}) {
  return {
    id: s.id,
    branchId: s.branchId,
    name: s.name ?? "",
    startTime: s.startTime,
    endTime: s.endTime,
    sortOrder: s.sortOrder,
    crossesMidnight: shiftCrossesMidnight(s.startTime, s.endTime),
    createdAt: s.createdAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const branchId = req.nextUrl.searchParams.get("branchId")?.trim() ?? "";
  if (!branchId) {
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });
  }

  const access = await assertBranchManage(required.user, branchId);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const shifts = await prisma.branchShift.findMany({
    where: { branchId },
    orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ shifts: shifts.map(serializeShift) });
}

export async function POST(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  let body: {
    branchId?: string;
    name?: string | null;
    startTime?: string;
    endTime?: string;
    sortOrder?: number;
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

  const startTime = body.startTime?.trim() ?? "";
  const endTime = body.endTime?.trim() ?? "";
  const validated = validateShiftTimes(startTime, endTime);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const name = body.name == null || body.name === "" ? null : String(body.name).trim();
  const sortOrder = Number.isFinite(body.sortOrder) ? Math.floor(body.sortOrder!) : 0;

  const shift = await prisma.branchShift.create({
    data: {
      branchId,
      name,
      startTime: validated.start,
      endTime: validated.end,
      sortOrder,
    },
  });

  return NextResponse.json({ shift: serializeShift(shift) });
}
