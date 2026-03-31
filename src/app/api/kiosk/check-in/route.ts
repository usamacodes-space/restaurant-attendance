import { prisma } from "@/lib/prisma";
import { getValidKioskSessionByPlainToken } from "@/lib/kiosk-session";
import { saveSelfie } from "@/lib/upload-selfie";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "").trim();
  const employeeId = String(form.get("employeeId") ?? "").trim();
  const branchId = String(form.get("branchId") ?? "").trim();
  const file = form.get("selfie");
  const latitudeRaw = String(form.get("latitude") ?? "").trim();
  const longitudeRaw = String(form.get("longitude") ?? "").trim();
  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;

  if (!token || !employeeId || !branchId) {
    return NextResponse.json({ error: "token, branchId and employeeId are required" }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selfie image required" }, { status: 400 });
  }

  const kiosk = await getValidKioskSessionByPlainToken(token);
  if (!kiosk) {
    return NextResponse.json({ error: "Invalid or expired kiosk session" }, { status: 401 });
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, companyId: true } });
  if (!branch || branch.companyId !== kiosk.branch.companyId) {
    return NextResponse.json({ error: "Invalid branch for this QR" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if (employee.companyId !== kiosk.branch.companyId || employee.branchId !== branch.id) {
    return NextResponse.json({ error: "Employee does not belong to selected branch" }, { status: 400 });
  }

  const existingOpen = await prisma.attendance.findFirst({
    where: { employeeId, branchId: branch.id, checkOutAt: null },
  });
  if (existingOpen) {
    return NextResponse.json({ error: "Already checked in" }, { status: 409 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";
  let selfieUrl: string;
  try {
    selfieUrl = await saveSelfie(buf, contentType);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to store selfie" }, { status: 500 });
  }

  const attendance = await prisma.attendance.create({
    data: {
      companyId: employee.companyId,
      branchId: branch.id,
      employeeId,
      kioskSessionId: kiosk.id,
      checkInAt: new Date(),
      checkInSelfieUrl: selfieUrl,
      checkInLatitude: Number.isFinite(latitude) ? latitude : null,
      checkInLongitude: Number.isFinite(longitude) ? longitude : null,
    },
  });

  return NextResponse.json({
    ok: true,
    attendanceId: attendance.id,
    checkInAt: attendance.checkInAt.toISOString(),
  });
}
