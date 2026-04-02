import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { saveQrLogo, type QrLogoSide } from "@/lib/upload-qr-logo";
import { NextRequest, NextResponse } from "next/server";

const SINGLETON_ID = "singleton";

export async function POST(req: NextRequest) {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const form = await req.formData();
  const sideRaw = String(form.get("side") ?? "").trim().toLowerCase();
  if (sideRaw !== "left" && sideRaw !== "right") {
    return NextResponse.json({ error: 'side must be "left" or "right"' }, { status: 400 });
  }
  const side = sideRaw as QrLogoSide;

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/png";

  let url: string;
  try {
    url = await saveQrLogo(buf, mime, side);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to store image" }, { status: 500 });
  }

  const field = side === "left" ? "qrLogoLeftUrl" : "qrLogoRightUrl";
  await prisma.globalSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      qrLogoLeftUrl: side === "left" ? url : null,
      qrLogoRightUrl: side === "right" ? url : null,
    },
    update: { [field]: url },
  });

  return NextResponse.json({ url, side });
}
