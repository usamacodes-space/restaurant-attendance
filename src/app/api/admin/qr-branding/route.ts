import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

export async function GET() {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  const row = await prisma.globalSettings.findUnique({
    where: { id: SINGLETON_ID },
    select: { qrLogoLeftUrl: true, qrLogoRightUrl: true },
  });

  return NextResponse.json({
    qrLogoLeftUrl: row?.qrLogoLeftUrl ?? "",
    qrLogoRightUrl: row?.qrLogoRightUrl ?? "",
  });
}

export async function PATCH(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  let body: { qrLogoLeftUrl?: string | null; qrLogoRightUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { qrLogoLeftUrl?: string | null; qrLogoRightUrl?: string | null } = {};
  if ("qrLogoLeftUrl" in body) {
    const v = body.qrLogoLeftUrl;
    data.qrLogoLeftUrl = v === null || v === "" ? null : String(v).trim();
  }
  if ("qrLogoRightUrl" in body) {
    const v = body.qrLogoRightUrl;
    data.qrLogoRightUrl = v === null || v === "" ? null : String(v).trim();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await prisma.globalSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      qrLogoLeftUrl: data.qrLogoLeftUrl ?? null,
      qrLogoRightUrl: data.qrLogoRightUrl ?? null,
    },
    update: data,
  });

  const row = await prisma.globalSettings.findUnique({
    where: { id: SINGLETON_ID },
    select: { qrLogoLeftUrl: true, qrLogoRightUrl: true },
  });

  return NextResponse.json({
    qrLogoLeftUrl: row?.qrLogoLeftUrl ?? "",
    qrLogoRightUrl: row?.qrLogoRightUrl ?? "",
  });
}
