import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

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

