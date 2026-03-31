import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (required.user.role === "COMPANY_ADMIN" && required.user.companyId !== branch.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; latitude?: number | null; longitude?: number | null; radiusMeters?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { name?: string; latitude?: number | null; longitude?: number | null; radiusMeters?: number } = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.latitude !== undefined) data.latitude = body.latitude;
  if (body.longitude !== undefined) data.longitude = body.longitude;
  if (body.radiusMeters !== undefined) data.radiusMeters = Math.max(1, Math.floor(body.radiusMeters));

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No changes" }, { status: 400 });

  const updated = await prisma.branch.update({ where: { id }, data });
  return NextResponse.json({ branch: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (required.user.role === "COMPANY_ADMIN" && required.user.companyId !== branch.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.branch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

