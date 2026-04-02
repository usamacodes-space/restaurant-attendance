import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

export type QrBranding = {
  qrLogoLeftUrl: string | null;
  qrLogoRightUrl: string | null;
};

export async function getQrBranding(): Promise<QrBranding> {
  const row = await prisma.globalSettings.findUnique({
    where: { id: SINGLETON_ID },
    select: { qrLogoLeftUrl: true, qrLogoRightUrl: true },
  });
  return {
    qrLogoLeftUrl: row?.qrLogoLeftUrl ?? null,
    qrLogoRightUrl: row?.qrLogoRightUrl ?? null,
  };
}
