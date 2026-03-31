import QRCode from "qrcode";
export default async function PublicQrPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; expiresAt?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";
  const expiresAt = params.expiresAt?.trim() ?? "";
  const branch = params.branch?.trim() ?? "";

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 dark:bg-zinc-950">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p className="font-semibold text-stone-900 dark:text-zinc-50">Invalid QR link</p>
          <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">Please generate a new branch QR link.</p>
        </div>
      </div>
    );
  }

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://restaurant-attendance.vercel.app";
  const kioskUrl = `${appBase}/kiosk?token=${encodeURIComponent(token)}`;
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
      <div className="w-full max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm uppercase tracking-wide text-stone-500 dark:text-zinc-400">WAQT Attendance</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900 dark:text-zinc-50">Scan to check-in / check-out</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
          {branch ? `Branch: ${branch}` : "Branch QR"} {expiresAt ? `• Expires: ${new Date(expiresAt).toLocaleString()}` : ""}
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

