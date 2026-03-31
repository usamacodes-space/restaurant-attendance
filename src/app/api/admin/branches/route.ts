import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const where =
    required.user.role === "MASTER_ADMIN" ? {} : { companyId: required.user.companyId ?? undefined };

  const branches = await prisma.branch.findMany({
    where,
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
  });

  return NextResponse.json({ branches });
}

export async function POST(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  let body: {
    name?: string;
    companyId?: string;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const companyId = body.companyId?.trim();
  if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  try {
    const branch = await prisma.branch.create({
      data: {
        companyId,
        name,
        latitude: typeof body.latitude === "number" ? body.latitude : null,
        longitude: typeof body.longitude === "number" ? body.longitude : null,
        radiusMeters: Number.isFinite(body.radiusMeters) ? Math.max(1, Math.floor(body.radiusMeters!)) : 100,
      },
      include: { company: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ branch });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") return NextResponse.json({ error: "Branch already exists for this company" }, { status: 409 });
    throw e;
  }
}
