import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { rotateKioskSessionForBranch } from "@/lib/kiosk-session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  let body: { branchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const branchId = body.branchId?.trim();
  if (!branchId) return NextResponse.json({ error: "branchId required" }, { status: 400 });

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  if (required.user.role === "COMPANY_ADMIN" && branch.companyId !== required.user.companyId) {
    return NextResponse.json({ error: "Forbidden branch" }, { status: 403 });
  }

  const activeSession = await rotateKioskSessionForBranch(branchId);
  if (!activeSession) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  return NextResponse.json({
    token: activeSession.token,
    expiresAt: activeSession.expiresAt.toISOString(),
    branch: { id: branch.id, name: branch.name },
  });
}
