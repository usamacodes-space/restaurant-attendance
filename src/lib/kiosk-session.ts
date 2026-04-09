import { generateKioskPlainToken, hashKioskToken } from "@/lib/kiosk-token";
import { prisma } from "@/lib/prisma";

export async function getValidKioskSessionByPlainToken(plainToken: string) {
  const tokenHash = hashKioskToken(plainToken);
  const now = new Date();
  const session = await prisma.kioskSession.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: now },
      revokedAt: null,
    },
    include: {
      branch: {
        select: { id: true, name: true, companyId: true, latitude: true, longitude: true, radiusMeters: true },
      },
    },
  });
  return session;
}

export function kioskSessionTtlMs(): number {
  const raw = Number(process.env.KIOSK_SESSION_HOURS ?? "2");
  const hours = Number.isFinite(raw) ? raw : 2;
  const clamped = Math.min(2, Math.max(1, hours));
  return clamped * 60 * 60 * 1000;
}

type ActiveKioskSession = { token: string; expiresAt: Date };

async function createAndPersistKioskSessionForBranch(branchId: string): Promise<ActiveKioskSession> {
  const plain = generateKioskPlainToken();
  const tokenHash = hashKioskToken(plain);
  const expiresAt = new Date(Date.now() + kioskSessionTtlMs());

  await prisma.$transaction([
    prisma.kioskSession.create({
      data: { tokenHash, expiresAt, branchId },
    }),
    prisma.branch.update({
      where: { id: branchId },
      data: { publicKioskToken: plain, publicKioskExpiresAt: expiresAt },
    }),
  ]);

  return { token: plain, expiresAt };
}

/**
 * Returns the active kiosk session for a branch. If none exists (or it expired),
 * a new one is created so stable branch links keep working without admin refresh.
 */
export async function ensureActiveKioskSessionForBranch(branchId: string): Promise<ActiveKioskSession | null> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, publicKioskToken: true, publicKioskExpiresAt: true },
  });
  if (!branch) return null;

  const now = new Date();
  if (branch.publicKioskToken && branch.publicKioskExpiresAt && branch.publicKioskExpiresAt > now) {
    return { token: branch.publicKioskToken, expiresAt: branch.publicKioskExpiresAt };
  }

  return createAndPersistKioskSessionForBranch(branchId);
}

/** Admin-triggered manual refresh that always rotates to a brand-new token. */
export async function rotateKioskSessionForBranch(branchId: string): Promise<ActiveKioskSession | null> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });
  if (!branch) return null;
  return createAndPersistKioskSessionForBranch(branchId);
}
