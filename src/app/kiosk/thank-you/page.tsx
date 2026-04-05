"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

function useBackNavigationLock() {
  useEffect(() => {
    // Keep users on this terminal step; attendance is already recorded.
    window.history.pushState({ kioskThankYou: true }, "", window.location.href);

    const onPopState = () => {
      window.history.pushState({ kioskThankYou: true }, "", window.location.href);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}

export default function KioskThankYouPage() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") ?? "").toLowerCase();

  useBackNavigationLock();

  const content = useMemo(() => {
    if (mode === "checkout") {
      return {
        title: "Thank you",
        message: "Check-out successful.",
        note: "You can close this page now.",
      };
    }

    return {
      title: "Thank you",
      message: "Check-in successful.",
      note: "If you scan the QR again later, it will continue with check-out.",
    };
  }, [mode]);

  return (
    <div className="border-border bg-card text-card-foreground mx-auto w-full max-w-md rounded-2xl border p-6 text-center shadow-sm">
      <p className="text-xl font-semibold">{content.title}</p>
      <p className="mt-2 text-base font-medium">{content.message}</p>
      <p className="text-muted-foreground mt-3 text-sm">{content.note}</p>
    </div>
  );
}
