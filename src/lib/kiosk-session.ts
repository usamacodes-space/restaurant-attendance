import { prisma } from "@/lib/prisma";
import { hashKioskToken } from "@/lib/kiosk-token";

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
