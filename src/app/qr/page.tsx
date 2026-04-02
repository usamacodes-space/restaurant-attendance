import { getQrBranding } from "@/lib/global-settings";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import { QrAutoRefresh } from "./qr-auto-refresh";

export const dynamic = "force-dynamic";

const cream = "#F9F9E0";
const forest = "#00332C";
const accentOrange = "#E85D04";

function LogoTile({ src, label }: { src: string | null; label: string }) {
  return (
    <div
      className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm sm:h-[100px] sm:w-[100px] md:h-[112px] md:w-[112px]"
      style={{ border: `2px solid ${forest}` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className="px-2 text-center text-[10px] font-medium leading-tight opacity-40" style={{ color: forest }}>
          {label}
        </span>
      )}
    </div>
  );
}

function QrLayout({
  branchName,
  qrLogoLeftUrl,
  qrLogoRightUrl,
  expiresAt,
  qrDataUrl,
  qrError,
  branchId,
  alternateRight,
}: {
  branchName: string;
  qrLogoLeftUrl: string | null;
  qrLogoRightUrl: string | null;
  expiresAt: Date | null;
  qrDataUrl: string | null;
  qrError: string | null;
  branchId: string;
  alternateRight?: ReactNode;
}) {
  return (
    <div className="min-h-screen px-4 py-8 sm:py-10 md:py-14" style={{ backgroundColor: cream, color: forest }}>
      {branchId ? <QrAutoRefresh branchId={branchId} /> : null}
      <div className="mx-auto flex max-w-5xl flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-10 lg:gap-16">
        <div className="flex min-w-0 flex-1 flex-col md:max-w-md">
          <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-3">
            <LogoTile src={qrLogoLeftUrl} label="Logo 1" />
            <span className="select-none text-2xl font-light leading-none sm:text-3xl" style={{ color: accentOrange }} aria-hidden>
              ×
            </span>
            <LogoTile src={qrLogoRightUrl} label="Logo 2" />
          </div>

          <div className="mt-8 inline-block max-w-full">
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-[2.75rem]">{branchName}</h1>
            <p className="mt-1 text-right text-sm font-normal leading-none">Branch</p>
          </div>
        </div>

        <div className="flex w-full flex-col items-center md:w-auto md:min-w-[280px] md:flex-initial lg:min-w-[320px]">
          {alternateRight ? (
            <div className="w-full max-w-sm pt-2 md:pt-10">{alternateRight}</div>
          ) : (
            <>
              <h2 className="text-center text-lg font-bold sm:text-xl">Scan to check-in / check-out</h2>

              <div className="mt-6 w-full max-w-[min(100%,320px)]">
                {qrDataUrl ? (
                  <div
                    className="mx-auto w-fit rounded-2xl bg-white p-3 sm:p-4"
                    style={{ border: `6px solid #000000` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="Attendance QR code" className="block h-auto w-full max-w-[260px]" />
                  </div>
                ) : (
                  <p className="text-center text-sm opacity-80">{qrError ?? "Generating QR..."}</p>
                )}
              </div>

              {expiresAt ? (
                <p className="mt-6 text-center text-sm font-normal sm:text-base">
                  Expires: {expiresAt.toLocaleString()}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function PublicQrPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; token?: string; expiresAt?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const branchId = params.branchId?.trim() ?? "";
  const legacyToken = params.token?.trim() ?? "";
  const legacyExpiresAt = params.expiresAt?.trim() ?? "";
  const legacyBranchName = params.branch?.trim() ?? "";

  const branding = await getQrBranding();

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://restaurant-attendance.vercel.app";

  let token = "";
  let expiresAt: Date | null = null;
  let branchName = "";

  if (branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true, publicKioskToken: true, publicKioskExpiresAt: true },
    });
    if (!branch) {
      return (
        <div className="min-h-screen px-4 py-16" style={{ backgroundColor: cream, color: forest }}>
          <div className="mx-auto max-w-md rounded-2xl border-2 p-6 text-center shadow-sm" style={{ borderColor: forest, backgroundColor: "#fffef5" }}>
            <p className="text-lg font-bold">Branch not found</p>
            <p className="mt-2 text-sm opacity-90">Check the link or ask an admin for the correct QR page.</p>
          </div>
        </div>
      );
    }
    branchName = branch.name;
    const now = new Date();
    if (
      branch.publicKioskToken &&
      branch.publicKioskExpiresAt &&
      branch.publicKioskExpiresAt > now
    ) {
      token = branch.publicKioskToken;
      expiresAt = branch.publicKioskExpiresAt;
    }
  } else if (legacyToken) {
    token = legacyToken;
    branchName = legacyBranchName || "Branch";
    if (legacyExpiresAt) {
      const d = new Date(legacyExpiresAt);
      expiresAt = Number.isFinite(d.getTime()) ? d : null;
    }
  }

  const kioskUrl = branchId
    ? `${appBase}/kiosk?branchId=${encodeURIComponent(branchId)}`
    : token
      ? `${appBase}/kiosk?token=${encodeURIComponent(token)}`
      : "";

  let qrDataUrl: string | null = null;
  let qrGenError: string | null = null;
  if (token && kioskUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(kioskUrl, {
        width: 520,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch {
      qrGenError = "Failed to render QR code.";
    }
  }

  if (!token) {
    const displayName = branchName || (branchId ? "Branch" : "Branch");
    return (
      <QrLayout
        branchName={displayName}
        qrLogoLeftUrl={branding.qrLogoLeftUrl}
        qrLogoRightUrl={branding.qrLogoRightUrl}
        expiresAt={null}
        qrDataUrl={null}
        qrError={null}
        branchId={branchId}
        alternateRight={
          <div
            className="mx-auto rounded-2xl border-2 px-5 py-6 text-center text-sm leading-relaxed"
            style={{ borderColor: forest, backgroundColor: "#fffef5" }}
          >
            <p className="font-bold">No active kiosk session</p>
            <p className="mt-2 opacity-90">
              Ask a company admin to open the dashboard and refresh the branch QR once. This page URL stays the same and will show the updated code automatically.
            </p>
          </div>
        }
      />
    );
  }

  return (
    <QrLayout
      branchName={branchName || "Branch"}
      qrLogoLeftUrl={branding.qrLogoLeftUrl}
      qrLogoRightUrl={branding.qrLogoRightUrl}
      expiresAt={expiresAt}
      qrDataUrl={qrDataUrl}
      qrError={qrGenError}
      branchId={branchId}
    />
  );
}
