import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/** Public: returns current kiosk plain token for a branch (same secrecy as scanning a token QR). */
export async function GET(req: NextRequest) {
  const branchId = req.nextUrl.searchParams.get("branchId")?.trim();
  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { publicKioskToken: true, publicKioskExpiresAt: true },
  });

  const now = new Date();
  if (
    !branch?.publicKioskToken ||
    !branch.publicKioskExpiresAt ||
    branch.publicKioskExpiresAt <= now
  ) {
    return NextResponse.json({ error: "No active kiosk session" }, { status: 404 });
  }

  return NextResponse.json({
    token: branch.publicKioskToken,
    expiresAt: branch.publicKioskExpiresAt.toISOString(),
  });
}
