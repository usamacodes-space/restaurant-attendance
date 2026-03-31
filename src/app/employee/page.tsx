"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function extractToken(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.searchParams.get("token");
  } catch {
    return value;
  }
}

export default function EmployeePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const stopScanner = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  useEffect(() => {
    if (status !== "loading" && !session?.user) {
      router.replace("/login?callbackUrl=%2Femployee");
    }
  }, [router, session?.user, status]);

  useEffect(() => {
    if (status !== "loading" && session?.user?.role && session.user.role !== "EMPLOYEE") {
      router.replace("/dashboard");
    }
  }, [router, session?.user?.role, status]);

  const goToKiosk = useCallback(
    (token: string) => {
      stopScanner();
      router.push(`/kiosk?token=${encodeURIComponent(token)}`);
    },
    [router, stopScanner]
  );

  const startScanner = useCallback(async () => {
    setError(null);
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setError("Camera is not available in this browser.");
      return;
    }
    if (!("BarcodeDetector" in window)) {
      setError("Live scanner is not supported on this device. Use your phone camera app or paste QR link.");
      return;
    }

    try {
      const DetectorCtor = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (input: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
      const detector = new DetectorCtor({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      mediaRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          const hit = barcodes[0]?.rawValue;
          if (!hit) return;
          const token = extractToken(hit);
          if (token) goToKiosk(token);
        } catch {
          // ignore frame decode errors
        }
      }, 500);
    } catch {
      setError("Could not start scanner. Allow camera permission and try again.");
      stopScanner();
    }
  }, [goToKiosk, stopScanner]);

  if (status === "loading" || !session?.user) {
    return <div className="flex flex-1 items-center justify-center text-sm text-stone-600 dark:text-zinc-400">Loading...</div>;
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-zinc-50">Employee Attendance</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
          Open this app icon, scan branch QR, then complete selfie check-in/out.
        </p>

        <div className="mt-4 space-y-3">
          {!scanning ? (
            <button
              type="button"
              onClick={() => void startScanner()}
              className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
            >
              Scan branch QR
            </button>
          ) : (
            <button
              type="button"
              onClick={stopScanner}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 dark:border-zinc-600 dark:text-zinc-200"
            >
              Stop scanner
            </button>
          )}

          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full rounded-xl bg-black ${scanning ? "block aspect-video" : "hidden"}`}
          />

          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-500 dark:text-zinc-400">Fallback: paste QR link or token</label>
            <input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="https://.../kiosk?token=..."
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => {
                const token = extractToken(manualInput);
                if (!token) {
                  setError("Invalid QR link/token.");
                  return;
                }
                goToKiosk(token);
              }}
              className="w-full rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 dark:border-zinc-600 dark:text-zinc-200"
            >
              Continue with token
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login?callbackUrl=%2Femployee" })}
          className="mt-6 w-full text-xs text-stone-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

