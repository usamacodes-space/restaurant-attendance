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
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
          <p className="font-semibold text-stone-900 dark:text-zinc-50">Kiosk unavailable</p>
          <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">{error}</p>
          <p className="mt-3 text-xs text-stone-500 dark:text-zinc-500">
            Ask an admin to refresh the branch QR in the dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <p className="text-sm text-stone-600 dark:text-zinc-400">Loading kiosk…</p>
      </div>
    );
  }

  return <KioskClient key={token} token={token} />;
}
