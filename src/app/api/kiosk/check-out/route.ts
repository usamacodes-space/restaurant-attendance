import { prisma } from "@/lib/prisma";
import { getValidKioskSessionByPlainToken } from "@/lib/kiosk-session";
import { saveSelfie } from "@/lib/upload-selfie";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let token: string;
  let employeeId: string;
  let branchId: string;
  let selfieFile: File | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let passcode = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    token = String(form.get("token") ?? "").trim();
    employeeId = String(form.get("employeeId") ?? "").trim();
    branchId = String(form.get("branchId") ?? "").trim();
    passcode = String(form.get("passcode") ?? "");
    const f = form.get("selfie");
    if (f instanceof File && f.size > 0) selfieFile = f;
    const lat = Number(String(form.get("latitude") ?? "").trim());
    const lng = Number(String(form.get("longitude") ?? "").trim());
    latitude = Number.isFinite(lat) ? lat : null;
    longitude = Number.isFinite(lng) ? lng : null;
  } else {
    let body: { token?: string; employeeId?: string; branchId?: string; passcode?: string; latitude?: number; longitude?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    token = body.token?.trim() ?? "";
    employeeId = body.employeeId?.trim() ?? "";
    branchId = body.branchId?.trim() ?? "";
    passcode = body.passcode ?? "";
    latitude = typeof body.latitude === "number" ? body.latitude : null;
    longitude = typeof body.longitude === "number" ? body.longitude : null;
  }

  if (!token || !employeeId || !branchId) {
    return NextResponse.json({ error: "token, branchId and employeeId are required" }, { status: 400 });
  }
  if (!passcode) {
    return NextResponse.json({ error: "passcode is required" }, { status: 400 });
  }

  const kiosk = await getValidKioskSessionByPlainToken(token);
  if (!kiosk) {
    return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, companyId: true } });
  if (!branch || branch.companyId !== kiosk.branch.companyId) {
    return NextResponse.json({ error: "Invalid branch for this QR" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, companyId: true, branchId: true, user: { select: { passwordHash: true } } },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if (employee.companyId !== kiosk.branch.companyId || employee.branchId !== branch.id) {
    return NextResponse.json({ error: "Employee does not belong to selected branch" }, { status: 400 });
  }
  const ok = await bcrypt.compare(passcode, employee.user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }

  const open = await prisma.attendance.findFirst({
    where: { employeeId, branchId: branch.id, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });
  if (!open) {
    return NextResponse.json({ error: "No open shift to check out" }, { status: 409 });
  }

  if (!(selfieFile instanceof File) || selfieFile.size === 0) {
    return NextResponse.json({ error: "Checkout selfie image required" }, { status: 400 });
  }

  const buf = Buffer.from(await selfieFile.arrayBuffer());
  const ct = selfieFile.type || "image/jpeg";
  let checkOutSelfieUrl: string;
  try {
    checkOutSelfieUrl = await saveSelfie(buf, ct);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to store selfie" }, { status: 500 });
  }

  const updated = await prisma.attendance.update({
    where: { id: open.id },
    data: {
      checkOutAt: new Date(),
      checkOutLatitude: Number.isFinite(latitude) ? latitude : null,
      checkOutLongitude: Number.isFinite(longitude) ? longitude : null,
      checkOutSelfieUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    attendanceId: updated.id,
    checkOutAt: updated.checkOutAt!.toISOString(),
  });
}
