import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

export type AppRole = "MASTER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE";
type AuthError = { error: NextResponse };
type AuthOk = { user: NonNullable<Session["user"]> };

export async function requireUser(): Promise<AuthError | AuthOk> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: session.user as NonNullable<Session["user"]> };
}

export async function requireRoles(roles: AppRole[]): Promise<AuthError | AuthOk> {
  const base = await requireUser();
  if (!("user" in base)) return base;
  if (!roles.includes(base.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return base;
}

