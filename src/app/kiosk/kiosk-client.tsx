"use client";

import { useEffect, useMemo, useState } from "react";

type Step = "loading" | "ready" | "camera" | "confirm" | "done";

export function KioskClient({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [hasOpenShift, setHasOpenShift] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });

  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/kiosk/employees?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid QR session");
        setStep("done");
        return;
      }
      setEmployeeName(data.employee?.name ?? "Employee");
      setBranchName(data.branch?.name ?? "Branch");

      const statusRes = await fetch("/api/kiosk/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const statusData = await statusRes.json();
      if (!statusRes.ok) {
        setError(statusData.error ?? "Could not load status");
        setStep("done");
        return;
      }
      setHasOpenShift(!!statusData.hasOpenShift);
      setStep("ready");
    }

    void init();
  }, [token]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function getLocation() {
    return new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => {
      if (!navigator.geolocation) return resolve({ latitude: null, longitude: null });
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve({ latitude: null, longitude: null }),
        { enableHighAccuracy: true, timeout: 7000 }
      );
    });
  }

  async function startCamera() {
    setError(null);
    try {
      const geo = await getLocation();
      setLocation(geo);
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(media);
      setStep("camera");
      const video = document.getElementById("kiosk-camera") as HTMLVideoElement | null;
      if (video) {
        video.srcObject = media;
        await video.play();
      }
    } catch {
      setError("Could not access camera. Please allow camera permission.");
    }
  }

  function capture() {
    const video = document.getElementById("kiosk-camera") as HTMLVideoElement | null;
    if (!video) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      setPhoto(b);
      stream?.getTracks().forEach((t) => t.stop());
      setStream(null);
      setStep("confirm");
    }, "image/jpeg", 0.85);
  }

  async function submitCheckIn() {
    if (!photo) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("token", token);
    if (location.latitude != null) fd.set("latitude", String(location.latitude));
    if (location.longitude != null) fd.set("longitude", String(location.longitude));
    fd.set("selfie", photo, "selfie.jpg");
    const res = await fetch("/api/kiosk/check-in", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Check-in failed");
    setStep("done");
  }

  async function submitCheckOut() {
    setBusy(true);
    const res = await fetch("/api/kiosk/check-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, latitude: location.latitude, longitude: location.longitude }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Check-out failed");
    setStep("done");
  }

  if (step === "loading") {
    return <p className="mx-auto py-12 text-sm text-stone-600 dark:text-zinc-400">Loading...</p>;
  }

  if (step === "done") {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
        <p className="text-lg font-semibold text-stone-900 dark:text-zinc-50">{error ? "Action failed" : "Done"}</p>
        <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">{error ?? "Attendance recorded."}</p>
      </div>
    );
  }

  if (step === "camera") {
    return (
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-zinc-50">Check in</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">{employeeName} at {branchName}</p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-black">
          <video id="kiosk-camera" playsInline muted className="aspect-[3/4] w-full object-cover" />
        </div>
        <button onClick={capture} className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white">Capture selfie</button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-zinc-50">Confirm check-in</h1>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selfie preview" className="mt-4 w-full rounded-2xl object-cover" />
        )}
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button disabled={busy} onClick={() => void submitCheckIn()} className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">{busy ? "Saving..." : "Submit check-in"}</button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
      <h1 className="text-xl font-semibold text-stone-900 dark:text-zinc-50">{hasOpenShift ? "Check out" : "Check in"}</h1>
      <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">{employeeName} at {branchName}</p>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {hasOpenShift ? (
        <button disabled={busy} onClick={() => void submitCheckOut()} className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">{busy ? "Saving..." : "Confirm check-out"}</button>
      ) : (
        <button onClick={() => void startCamera()} className="mt-6 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white">Start check-in</button>
      )}
      <p className="mt-3 text-xs text-stone-500 dark:text-zinc-500">Location is captured with attendance.</p>
    </div>
  );
}
