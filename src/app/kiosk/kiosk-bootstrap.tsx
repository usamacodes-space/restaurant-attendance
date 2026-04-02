"use client";

import { useEffect, useState } from "react";
import { KioskClient } from "./kiosk-client";

type Props = { branchId: string };

export function KioskBootstrap({ branchId }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/kiosk/resolve-token?branchId=${encodeURIComponent(branchId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load kiosk session");
          setToken(null);
          return;
        }
        setError(null);
        setToken(data.token as string);
      } catch {
        if (!cancelled) setError("Network error loading kiosk session");
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [branchId]);

  if (error && !token) {
    return (
      <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="border-border bg-card text-card-foreground max-w-md rounded-2xl border p-6 text-center shadow-sm">
          <p className="font-semibold">Kiosk unavailable</p>
          <p className="text-muted-foreground mt-2 text-sm">{error}</p>
          <p className="text-muted-foreground mt-3 text-xs">Ask an admin to refresh the branch QR in the dashboard.</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center px-4 py-10">
        <p className="text-muted-foreground text-sm">Loading kiosk…</p>
      </div>
    );
  }

  return <KioskClient key={token} token={token} />;
}
