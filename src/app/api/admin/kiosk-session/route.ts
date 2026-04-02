import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { generateKioskPlainToken, hashKioskToken } from "@/lib/kiosk-token";
import { kioskSessionTtlMs } from "@/lib/kiosk-session";
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

  const plain = generateKioskPlainToken();
  const tokenHash = hashKioskToken(plain);
  const expiresAt = new Date(Date.now() + kioskSessionTtlMs());

  await prisma.$transaction([
    prisma.kioskSession.create({
      data: { tokenHash, expiresAt, branchId },
    }),
    prisma.branch.update({
      where: { id: branchId },
      data: { publicKioskToken: plain, publicKioskExpiresAt: expiresAt },
    }),
  ]);

  return NextResponse.json({
    token: plain,
    expiresAt: expiresAt.toISOString(),
    branch: { id: branch.id, name: branch.name },
  });
}
