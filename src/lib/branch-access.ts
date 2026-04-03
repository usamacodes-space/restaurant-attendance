import { prisma } from "@/lib/prisma";

type SessionUser = {
  role: "MASTER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE";
  companyId?: string | null;
};

/** Returns branch id if caller may manage this branch, else null. */
export async function assertBranchManage(user: SessionUser, branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, companyId: true },
  });
  if (!branch) return { ok: false as const, status: 404 as const, message: "Branch not found" };
  if (user.role === "MASTER_ADMIN") return { ok: true as const, branch };
  if (user.role === "COMPANY_ADMIN" && user.companyId === branch.companyId) {
    return { ok: true as const, branch };
  }
  return { ok: false as const, status: 403 as const, message: "Forbidden" };
}

export async function assertShiftManage(user: SessionUser, shiftId: string) {
  const shift = await prisma.branchShift.findUnique({
    where: { id: shiftId },
    select: { id: true, branchId: true, branch: { select: { companyId: true } } },
  });
  if (!shift) return { ok: false as const, status: 404 as const, message: "Shift not found" };
  if (user.role === "MASTER_ADMIN") return { ok: true as const, shift };
  if (user.role === "COMPANY_ADMIN" && user.companyId === shift.branch.companyId) {
    return { ok: true as const, shift };
  }
  return { ok: false as const, status: 403 as const, message: "Forbidden" };
}
