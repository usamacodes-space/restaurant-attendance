import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { saveCompanyQrLogo } from "@/lib/upload-qr-logo";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;
  if (required.user.role === "COMPANY_ADMIN") {
    if (required.user.companyId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const company = await prisma.company.findUnique({ where: { id }, select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const form = await req.formData();
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
    url = await saveCompanyQrLogo(id, buf, mime);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to store image" }, { status: 500 });
  }

  await prisma.company.update({
    where: { id },
    data: { qrCompanyLogoUrl: url },
  });

  return NextResponse.json({ url, qrCompanyLogoUrl: url });
}
