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
  const hours = Number(process.env.KIOSK_SESSION_HOURS ?? "12");
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 60 * 60 * 1000;
}
