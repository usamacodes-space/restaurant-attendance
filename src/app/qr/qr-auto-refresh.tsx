"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Periodically refreshes the server component so the QR reflects the latest token from the dashboard. */
export function QrAutoRefresh({ branchId }: { branchId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!branchId) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [branchId, router]);
  return null;
}
