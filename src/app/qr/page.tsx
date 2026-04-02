import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import { QrAutoRefresh } from "./qr-auto-refresh";

export const dynamic = "force-dynamic";

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
        <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 dark:bg-zinc-950">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold text-stone-900 dark:text-zinc-50">Branch not found</p>
            <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">Check the link or ask an admin for the correct QR page.</p>
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
    branchName = legacyBranchName;
    if (legacyExpiresAt) {
      const d = new Date(legacyExpiresAt);
      expiresAt = Number.isFinite(d.getTime()) ? d : null;
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 dark:bg-zinc-950">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p className="font-semibold text-stone-900 dark:text-zinc-50">No active kiosk session</p>
          <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
            Ask a company admin to open the dashboard and refresh the branch QR once. This page URL stays the same and will show the updated code automatically.
          </p>
        </div>
      </div>
    );
  }

  // Branch QR: encode only branchId (no token in the barcode). Legacy links still use token in URL.
  const kioskUrl = branchId
    ? `${appBase}/kiosk?branchId=${encodeURIComponent(branchId)}`
    : `${appBase}/kiosk?token=${encodeURIComponent(token)}`;
  let qrDataUrl: string | null = null;
  let error: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(kioskUrl, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  } catch {
    error = "Failed to render QR code.";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-8 dark:bg-zinc-950">
      {branchId ? <QrAutoRefresh branchId={branchId} /> : null}
      <div className="w-full max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm uppercase tracking-wide text-stone-500 dark:text-zinc-400">WAQT Attendance</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900 dark:text-zinc-50">Scan to check-in / check-out</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
          {branchName ? `Branch: ${branchName}` : "Branch QR"}
          {expiresAt ? ` • Expires: ${expiresAt.toLocaleString()}` : ""}
        </p>

        <div className="mt-8 flex justify-center">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Attendance QR code" className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-zinc-600" />
          ) : (
            <p className="text-sm text-stone-500 dark:text-zinc-400">{error ?? "Generating QR..."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
