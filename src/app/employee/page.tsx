"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { primaryButtonClass } from "@/lib/constants-ui";

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
      setError("Live scanner is not supported on this device. Paste a kiosk link with token or open the camera app.");
      return;
    }

    try {
      const DetectorCtor = (
        window as unknown as {
          BarcodeDetector: new (opts: { formats: string[] }) => {
            detect: (input: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;
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

  return (
    <div className="flex min-h-[100dvh] flex-1 items-center justify-center px-4 py-8 sm:py-10">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="px-6 pt-8">
          <CardTitle className="text-xl sm:text-2xl">Employee attendance</CardTitle>
          <CardDescription>Scan the branch QR, then complete check-in or check-out on the kiosk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-8">
          {!scanning ? (
            <Button type="button" className={`h-12 w-full text-base ${primaryButtonClass}`} onClick={() => void startScanner()}>
              Scan branch QR
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-12 w-full" onClick={stopScanner}>
              Stop scanner
            </Button>
          )}

          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full rounded-xl bg-black ${scanning ? "block aspect-video" : "hidden"}`}
          />

          <div className="space-y-2">
            <Label htmlFor="manual-qr" className="text-muted-foreground text-xs font-medium">
              Or paste kiosk link / token
            </Label>
            <Input
              id="manual-qr"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="https://…/kiosk?token=…"
              className="text-sm"
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                const token = extractToken(manualInput);
                if (!token) {
                  setError("Enter a valid kiosk link or token.");
                  return;
                }
                goToKiosk(token);
              }}
            >
              Continue
            </Button>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
