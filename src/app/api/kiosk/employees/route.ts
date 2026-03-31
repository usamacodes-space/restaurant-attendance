import { requireRoles } from "@/lib/authz";
import { getValidKioskSessionByPlainToken } from "@/lib/kiosk-session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const required = await requireRoles(["EMPLOYEE"]);
  if (!("user" in required)) return required.error;

  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const kiosk = await getValidKioskSessionByPlainToken(token);
  if (!kiosk) {
    return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
  }

  if (required.user.companyId && required.user.companyId !== kiosk.branch.companyId) {
    return NextResponse.json({ error: "This QR belongs to a different company" }, { status: 403 });
  }

  return NextResponse.json({
    branch: kiosk.branch,
    tokenValid: true,
    employee: {
      id: required.user.employeeId,
      name: required.user.name ?? required.user.email,
      email: required.user.email,
    },
  });
}
