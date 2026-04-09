import { ensureActiveKioskSessionForBranch } from "@/lib/kiosk-session";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public: returns current kiosk plain token for a branch (same secrecy as scanning a token QR). */
export async function GET(req: NextRequest) {
  const branchId = req.nextUrl.searchParams.get("branchId")?.trim();
  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  const activeSession = await ensureActiveKioskSessionForBranch(branchId);
  if (!activeSession) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  return NextResponse.json({
    token: activeSession.token,
    expiresAt: activeSession.expiresAt.toISOString(),
  });
}
