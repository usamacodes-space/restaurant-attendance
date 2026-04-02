import { KioskBootstrap } from "./kiosk-bootstrap";
import { KioskClient } from "./kiosk-client";

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; branchId?: string }>;
}) {
  const { token, branchId } = await searchParams;
  const branchIdTrim = branchId?.trim() ?? "";
  const tokenTrim = token?.trim() ?? "";

  if (branchIdTrim) {
    return <KioskBootstrap branchId={branchIdTrim} />;
  }

  if (tokenTrim) {
    return <KioskClient token={tokenTrim} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12">
      <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
        <p className="font-semibold text-stone-900 dark:text-zinc-50">Open this page from the QR code</p>
        <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
          Scan the code on the restaurant screen with your phone&apos;s camera. It will open this check-in page on your
          device.
        </p>
      </div>
    </div>
  );
}
