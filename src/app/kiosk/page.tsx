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
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="border-border bg-card text-card-foreground max-w-md rounded-2xl border p-6 text-center shadow-sm">
        <p className="font-semibold">Open this page from the QR code</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Scan the code on the restaurant screen with your phone&apos;s camera. It will open this check-in page on your
          device.
        </p>
      </div>
    </div>
  );
}
