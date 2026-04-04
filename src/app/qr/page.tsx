import { getQrBranding } from "@/lib/global-settings";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import { QrAutoRefresh } from "./qr-auto-refresh";

export const dynamic = "force-dynamic";

const cream = "#fdfeea";
const forest = "#0a4646";
const accentSlate = "#7d98a1";

/** Framed logo: inner rounded well so artwork matches the border radius; empty state uses a soft fill, not a blank tile. */
function LogoTile({ src, label }: { src: string | null; label: string }) {
  const frame =
    "flex h-[88px] w-[88px] shrink-0 flex-col rounded-xl border-2 border-[#0a4646] bg-white p-2 shadow-sm sm:h-[100px] sm:w-[100px] sm:p-2.5 md:h-[112px] md:w-[112px]";
  const inner = "flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg";

  return (
    <div className={frame}>
      {src ? (
        <div className={`${inner} bg-white`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="max-h-full max-w-full rounded-md object-contain object-center"
            loading="eager"
            decoding="async"
          />
        </div>
      ) : (
        <div
          className={`${inner} bg-gradient-to-br from-white via-[#fdfeea] to-[#e4eded]`}
          aria-label={label === "WAQT" ? "WAQT logo not set" : "Company logo not set"}
        >
          <span
            className="px-1 text-center text-[9px] font-bold uppercase leading-snug tracking-wide text-balance opacity-75 sm:text-[10px]"
            style={{ color: forest }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

function QrLayout({
  branchName,
  waqtLogoUrl,
  companyLogoUrl,
  expiresAt,
  qrDataUrl,
  qrError,
  branchId,
  alternateRight,
}: {
  branchName: string;
  /** Global WAQT logo (same on every QR page). */
  waqtLogoUrl: string | null;
  /** Per-company logo on public QR page (optional). */
  companyLogoUrl: string | null;
  expiresAt: Date | null;
  qrDataUrl: string | null;
  qrError: string | null;
  branchId: string;
  alternateRight?: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-10 md:py-14"
      style={{ backgroundColor: cream, color: forest }}
    >
      {branchId ? <QrAutoRefresh branchId={branchId} /> : null}
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-12 md:flex-row md:gap-10 lg:gap-16">
        <div className="flex min-w-0 flex-col items-center text-center md:max-w-md">
          <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3">
            <LogoTile src={waqtLogoUrl} label="WAQT" />
            <span className="select-none text-2xl font-light leading-none sm:text-3xl" style={{ color: accentSlate }} aria-hidden>
              ×
            </span>
            <LogoTile src={companyLogoUrl} label="Company" />
          </div>

          <div className="mt-8 flex max-w-full flex-col items-center">
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-[2.75rem]">{branchName}</h1>
            <p className="mt-1.5 text-sm font-normal leading-none">Branch</p>
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-center text-center md:w-auto md:min-w-[280px] md:flex-initial lg:min-w-[320px]">
          {alternateRight ? (
            <div className="flex w-full max-w-sm justify-center">{alternateRight}</div>
          ) : (
            <>
              <h2 className="text-lg font-bold sm:text-xl">Scan to check-in / check-out</h2>

              <div className="mt-6 flex w-full max-w-[min(100%,320px)] justify-center">
                {qrDataUrl ? (
                  <div
                    className="w-fit rounded-2xl bg-white p-3 sm:p-4"
                    style={{ border: `6px solid ${forest}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="Attendance QR code" className="block h-auto w-full max-w-[260px]" />
                  </div>
                ) : (
                  <p className="text-sm opacity-80">{qrError ?? "Generating QR..."}</p>
                )}
              </div>

              {expiresAt ? (
                <p className="mt-6 text-sm font-normal sm:text-base">
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
  const waqtLogoUrl = branding.qrLogoLeftUrl;

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://restaurant-attendance.vercel.app";

  let token = "";
  let expiresAt: Date | null = null;
  let branchName = "";

  let companyLogoUrl: string | null = null;

  if (branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        name: true,
        publicKioskToken: true,
        publicKioskExpiresAt: true,
        company: { select: { qrCompanyLogoUrl: true } },
      },
    });
    if (!branch) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
          style={{ backgroundColor: cream, color: forest }}
        >
          <div
            className="mx-auto max-w-md rounded-2xl border-2 p-6 text-center shadow-sm"
            style={{ borderColor: accentSlate, backgroundColor: "color-mix(in srgb, white 35%, #fdfeea)" }}
          >
            <p className="text-lg font-bold">Branch not found</p>
            <p className="mt-2 text-sm opacity-90">Check the link or ask an admin for the correct QR page.</p>
          </div>
        </div>
      );
    }
    branchName = branch.name;
    companyLogoUrl = branch.company.qrCompanyLogoUrl ?? null;
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
        color: { dark: forest, light: cream },
      });
    } catch {
      qrGenError = "Failed to render QR code.";
    }
  }

  const resolvedCompanyLogo = companyLogoUrl;

  if (!token) {
    const displayName = branchName || (branchId ? "Branch" : "Branch");
    return (
      <QrLayout
        branchName={displayName}
        waqtLogoUrl={waqtLogoUrl}
        companyLogoUrl={resolvedCompanyLogo}
        expiresAt={null}
        qrDataUrl={null}
        qrError={null}
        branchId={branchId}
        alternateRight={
          <div
            className="mx-auto rounded-2xl border-2 px-5 py-6 text-center text-sm leading-relaxed"
            style={{ borderColor: accentSlate, backgroundColor: "color-mix(in srgb, white 35%, #fdfeea)" }}
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
      waqtLogoUrl={waqtLogoUrl}
      companyLogoUrl={resolvedCompanyLogo}
      expiresAt={expiresAt}
      qrDataUrl={qrDataUrl}
      qrError={qrGenError}
      branchId={branchId}
    />
  );
}
