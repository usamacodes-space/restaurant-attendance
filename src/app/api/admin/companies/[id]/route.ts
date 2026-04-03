import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN", "COMPANY_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;
  let body: {
    name?: string;
    adminEmail?: string;
    adminPassword?: string;
    qrCompanyLogoUrl?: string | null;
    attendanceGoogleSpreadsheetId?: string | null;
    attendanceGoogleSheetTabName?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (required.user.role === "COMPANY_ADMIN") {
    if (required.user.companyId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const allowedCompanyAdmin = new Set([
      "qrCompanyLogoUrl",
      "attendanceGoogleSpreadsheetId",
      "attendanceGoogleSheetTabName",
    ]);
    const forbiddenKeys = Object.keys(body).filter((k) => !allowedCompanyAdmin.has(k));
    if (forbiddenKeys.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const hasSheetId = "attendanceGoogleSpreadsheetId" in body;
    const hasSheetTab = "attendanceGoogleSheetTabName" in body;
    if (!("qrCompanyLogoUrl" in body) && !hasSheetId && !hasSheetTab) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }
    const data: {
      qrCompanyLogoUrl?: string | null;
      attendanceGoogleSpreadsheetId?: string | null;
      attendanceGoogleSheetTabName?: string | null;
    } = {};
    if ("qrCompanyLogoUrl" in body) {
      const v = body.qrCompanyLogoUrl;
      data.qrCompanyLogoUrl = v === null || v === "" ? null : String(v).trim();
    }
    if (hasSheetId) {
      const v = body.attendanceGoogleSpreadsheetId;
      data.attendanceGoogleSpreadsheetId = v === null || v === "" ? null : String(v).trim();
    }
    if (hasSheetTab) {
      const v = body.attendanceGoogleSheetTabName;
      data.attendanceGoogleSheetTabName = v === null || v === "" ? null : String(v).trim();
    }
    try {
      const company = await prisma.company.update({
        where: { id },
        data,
      });
      return NextResponse.json({ company });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
      if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
      throw e;
    }
  }

  const name = body.name?.trim();
  const adminEmail = body.adminEmail?.trim().toLowerCase();
  const adminPassword = body.adminPassword ?? "";
  const hasQrUrl = "qrCompanyLogoUrl" in body;
  const qrCompanyLogoUrl =
    hasQrUrl && (body.qrCompanyLogoUrl === null || body.qrCompanyLogoUrl === "")
      ? null
      : hasQrUrl
        ? String(body.qrCompanyLogoUrl).trim()
        : undefined;
  const hasSheetId = "attendanceGoogleSpreadsheetId" in body;
  const attendanceGoogleSpreadsheetId =
    hasSheetId && (body.attendanceGoogleSpreadsheetId === null || body.attendanceGoogleSpreadsheetId === "")
      ? null
      : hasSheetId
        ? String(body.attendanceGoogleSpreadsheetId).trim()
        : undefined;
  const hasSheetTab = "attendanceGoogleSheetTabName" in body;
  const attendanceGoogleSheetTabName =
    hasSheetTab && (body.attendanceGoogleSheetTabName === null || body.attendanceGoogleSheetTabName === "")
      ? null
      : hasSheetTab
        ? String(body.attendanceGoogleSheetTabName).trim()
        : undefined;

  if (
    !name &&
    !adminEmail &&
    !adminPassword &&
    qrCompanyLogoUrl === undefined &&
    attendanceGoogleSpreadsheetId === undefined &&
    attendanceGoogleSheetTabName === undefined
  ) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      let company = null;
      const companyPatch: Record<string, unknown> = {};
      if (name) companyPatch.name = name;
      if (qrCompanyLogoUrl !== undefined) companyPatch.qrCompanyLogoUrl = qrCompanyLogoUrl;
      if (attendanceGoogleSpreadsheetId !== undefined)
        companyPatch.attendanceGoogleSpreadsheetId = attendanceGoogleSpreadsheetId;
      if (attendanceGoogleSheetTabName !== undefined)
        companyPatch.attendanceGoogleSheetTabName = attendanceGoogleSheetTabName;

      if (Object.keys(companyPatch).length) {
        company = await tx.company.update({
          where: { id },
          data: companyPatch as {
            name?: string;
            qrCompanyLogoUrl?: string | null;
            attendanceGoogleSpreadsheetId?: string | null;
            attendanceGoogleSheetTabName?: string | null;
          },
        });
      } else {
        company = await tx.company.findUnique({ where: { id } });
      }

      const existingAdmin = await tx.user.findFirst({
        where: { companyId: id, role: "COMPANY_ADMIN" },
        select: { id: true },
      });

      if (adminEmail || adminPassword) {
        if (!existingAdmin) {
          if (!adminEmail || adminPassword.length < 6) {
            throw new Error("Missing adminEmail or adminPassword (min 6 chars) for new company admin.");
          }
          await tx.user.create({
            data: {
              email: adminEmail!,
              passwordHash: await bcrypt.hash(adminPassword, 10),
              role: "COMPANY_ADMIN",
              companyId: id,
            },
          });
        } else {
          const data: { email?: string; passwordHash?: string } = {};
          if (adminEmail) {
            data.email = adminEmail;
          }
          if (adminPassword) {
            if (adminPassword.length < 6) {
              throw new Error("adminPassword must be at least 6 characters.");
            }
            data.passwordHash = await bcrypt.hash(adminPassword, 10);
          }
          await tx.user.update({
            where: { id: existingAdmin.id },
            data,
          });
        }
      }

      return { company };
    });

    return NextResponse.json({ company: updated.company });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "Duplicate company name or admin email" }, { status: 409 });
    const msg = e instanceof Error ? e.message : "";
    if (msg) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const required = await requireRoles(["MASTER_ADMIN"]);
  if (!("user" in required)) return required.error;

  const { id } = await ctx.params;
  try {
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
