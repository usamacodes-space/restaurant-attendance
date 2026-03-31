import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getValidKioskSessionByPlainToken } from "@/lib/kiosk-session";
import { saveSelfie } from "@/lib/upload-selfie";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const required = await requireRoles(["EMPLOYEE"]);
  if (!("user" in required)) return required.error;

  const contentType = req.headers.get("content-type") ?? "";
  let token: string;
  let selfieFile: File | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  const employeeId = required.user.employeeId ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    token = String(form.get("token") ?? "").trim();
    const f = form.get("selfie");
    if (f instanceof File && f.size > 0) selfieFile = f;
    const lat = Number(String(form.get("latitude") ?? "").trim());
    const lng = Number(String(form.get("longitude") ?? "").trim());
    latitude = Number.isFinite(lat) ? lat : null;
    longitude = Number.isFinite(lng) ? lng : null;
  } else {
    let body: { token?: string; latitude?: number; longitude?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    token = body.token?.trim() ?? "";
    latitude = typeof body.latitude === "number" ? body.latitude : null;
    longitude = typeof body.longitude === "number" ? body.longitude : null;
  }

  if (!token || !employeeId) {
    return NextResponse.json({ error: "token required and employee profile must exist" }, { status: 400 });
  }

  const kiosk = await getValidKioskSessionByPlainToken(token);
  if (!kiosk) {
    return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if (employee.companyId !== kiosk.branch.companyId) {
    return NextResponse.json({ error: "QR does not belong to your company" }, { status: 403 });
  }

  const open = await prisma.attendance.findFirst({
    where: { employeeId, branchId: kiosk.branch.id, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });
  if (!open) {
    return NextResponse.json({ error: "No open shift to check out" }, { status: 409 });
  }

  let checkOutSelfieUrl: string | null = null;
  if (selfieFile) {
    const buf = Buffer.from(await selfieFile.arrayBuffer());
    const ct = selfieFile.type || "image/jpeg";
    try {
      checkOutSelfieUrl = await saveSelfie(buf, ct);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Failed to store selfie" }, { status: 500 });
    }
  }

  const updated = await prisma.attendance.update({
    where: { id: open.id },
    data: {
      checkOutAt: new Date(),
      checkOutLatitude: Number.isFinite(latitude) ? latitude : null,
      checkOutLongitude: Number.isFinite(longitude) ? longitude : null,
      ...(checkOutSelfieUrl ? { checkOutSelfieUrl } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    attendanceId: updated.id,
    checkOutAt: updated.checkOutAt!.toISOString(),
  });
}
