import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { assertShiftManage } from "@/lib/branch-access";
import { prisma } from "@/lib/prisma";
import { shiftCrossesMidnight, validateShiftTimes } from "@/lib/shift-time";

type Ctx = { params: Promise<{ id: string }> };

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

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;

  const access = await assertShiftManage(required.user, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  let body: {
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

  const data: {
    name?: string | null;
    startTime?: string;
    endTime?: string;
    sortOrder?: number;
  } = {};

  if ("name" in body) {
    data.name = body.name == null || body.name === "" ? null : String(body.name).trim();
  }
  if ("sortOrder" in body && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.floor(body.sortOrder!);
  }

  if (body.startTime !== undefined || body.endTime !== undefined) {
    const existing = await prisma.branchShift.findUnique({
      where: { id },
      select: { startTime: true, endTime: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const start = (body.startTime !== undefined ? body.startTime : existing.startTime).trim();
    const end = (body.endTime !== undefined ? body.endTime : existing.endTime).trim();
    const validated = validateShiftTimes(start, end);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    data.startTime = validated.start;
    data.endTime = validated.end;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    const shift = await prisma.branchShift.update({
      where: { id },
      data,
    });
    return NextResponse.json({ shift: serializeShift(shift) });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;

  const access = await assertShiftManage(required.user, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  try {
    await prisma.branchShift.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
