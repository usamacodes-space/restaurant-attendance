"use client";

import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";

type Step = "loading" | "select" | "camera" | "confirm" | "done";
type AttendanceFlow = "checkin" | "checkout";
type Branch = { id: string; name: string };
type Employee = {
  id: string;
  name: string;
  role: string;
  branch: { id: string; name: string };
  company: { id: string; name: string };
};

export function KioskClient({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [passcode, setPasscode] = useState("");
  const [attendanceFlow, setAttendanceFlow] = useState<AttendanceFlow>("checkin");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    async function load(branchId?: string) {
      const q = new URLSearchParams({ token });
      if (branchId) q.set("branchId", branchId);
      const res = await fetch(`/api/kiosk/employees?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid QR session");
        setStep("done");
        return;
      }
      setBranches(data.branches ?? []);
      setEmployees(data.employees ?? []);
      const nextBranch = data.selectedBranchId ?? "";
      setSelectedBranchId(nextBranch);
      if ((data.employees ?? []).length > 0) {
        const firstId = data.employees[0].id;
        setSelectedEmployeeId((prev) => (prev && data.employees.some((e: Employee) => e.id === prev) ? prev : firstId));
      } else {
        setSelectedEmployeeId("");
      }
      setStep("select");
    }
    void load();
  }, [token]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  useEffect(() => {
    async function attach() {
      if (step !== "camera" || !stream || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        setError("Could not start camera preview.");
      }
    }
    void attach();
  }, [step, stream]);

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

  useEffect(() => {
    if (!selectedEmployeeId) {
      setSelectedEmployee(null);
      return;
    }
    const found = employees.find((e) => e.id === selectedEmployeeId) ?? null;
    setSelectedEmployee(found);
  }, [employees, selectedEmployeeId]);

  async function refreshForBranch(branchId: string) {
    setError(null);
    const q = new URLSearchParams({ token, branchId });
    const res = await fetch(`/api/kiosk/employees?${q.toString()}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to load branch employees");
    setEmployees(data.employees ?? []);
    setSelectedBranchId(data.selectedBranchId ?? branchId);
    setSelectedEmployeeId((data.employees ?? [])[0]?.id ?? "");
  }

  async function resolveAttendanceAction(): Promise<"checkout" | "checkin" | null> {
    if (!selectedEmployeeId || !selectedBranchId) return null;
    if (!passcode.trim()) {
      setError("Enter your passcode.");
      return null;
    }
    setError(null);
    const statusRes = await fetch("/api/kiosk/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, employeeId: selectedEmployeeId, branchId: selectedBranchId, passcode }),
    });
    const statusData = await statusRes.json();
    if (!statusRes.ok) {
      setError(statusData.error ?? "Could not load status");
      return null;
    }
    return statusData.hasOpenShift ? "checkout" : "checkin";
  }

  async function startCamera() {
    if (!selectedEmployeeId || !selectedBranchId) {
      setError("Please select branch and employee.");
      return;
    }
    setError(null);
    try {
      const geo = await getLocation();
      setLocation(geo);
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(media);
      setStep("camera");
    } catch {
      setError("Could not access camera. Please allow camera permission.");
    }
  }

  async function continueAction() {
    const action = await resolveAttendanceAction();
    if (!action) return;
    setAttendanceFlow(action === "checkout" ? "checkout" : "checkin");
    setPhoto(null);
    await startCamera();
  }

  function capture() {
    const video = videoRef.current;
    if (!video) {
      setError("Camera preview is not ready yet.");
      return;
    }
    if (video.videoWidth < 32 || video.videoHeight < 32) {
      setError("Camera is still loading. Please wait one second and tap Capture again.");
      return;
    }
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
    fd.set("branchId", selectedBranchId);
    fd.set("employeeId", selectedEmployeeId);
    fd.set("passcode", passcode);
    if (location.latitude != null) fd.set("latitude", String(location.latitude));
    if (location.longitude != null) fd.set("longitude", String(location.longitude));
    fd.set("selfie", photo, "selfie.jpg");
    const res = await fetch("/api/kiosk/check-in", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Check-in failed");
    setMessage("You are checked-in successfully.");
    setPasscode("");
    setPhoto(null);
    setStep("done");
  }

  async function submitCheckOut() {
    if (!photo) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("token", token);
    fd.set("branchId", selectedBranchId);
    fd.set("employeeId", selectedEmployeeId);
    fd.set("passcode", passcode);
    if (location.latitude != null) fd.set("latitude", String(location.latitude));
    if (location.longitude != null) fd.set("longitude", String(location.longitude));
    fd.set("selfie", photo, "checkout-selfie.jpg");
    const res = await fetch("/api/kiosk/check-out", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Check-out failed");
    setMessage("You checked-out successfully.");
    setPasscode("");
    setPhoto(null);
    setStep("done");
  }

  if (step === "loading") {
    return <p className="mx-auto py-12 text-sm text-stone-600 dark:text-zinc-400">Loading...</p>;
  }

  if (step === "done") {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
        <p className="text-lg font-semibold text-stone-900 dark:text-zinc-50">{error ? "Action failed" : "Done"}</p>
        <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">{error ?? message ?? "Attendance recorded."}</p>
      </div>
    );
  }

  if (step === "camera") {
    return (
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-zinc-50">
          {attendanceFlow === "checkout" ? "Check out — take a selfie" : "Check in — take a selfie"}
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
          {selectedEmployee?.name ?? "Employee"} at {selectedEmployee?.branch.name ?? "Branch"}
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="aspect-[3/4] w-full object-cover" />
        </div>
        <button onClick={capture} className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white">Capture selfie</button>
      </div>
    );
  }

  if (step === "confirm") {
    const isOut = attendanceFlow === "checkout";
    return (
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-zinc-50">
          {isOut ? "Confirm check-out" : "Confirm check-in"}
        </h1>
        {isOut && (
          <div className="mt-2 space-y-0.5 text-sm text-stone-600 dark:text-zinc-400">
            <p>{selectedEmployee?.company.name ?? "-"} · {selectedEmployee?.branch.name ?? "-"}</p>
            <p className="font-medium text-stone-800 dark:text-zinc-200">{selectedEmployee?.name ?? "-"} · {(selectedEmployee?.role ?? "OTHER").replaceAll("_", " ")}</p>
          </div>
        )}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selfie preview" className="mt-4 w-full rounded-2xl object-cover" />
        )}
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          disabled={busy}
          onClick={() => void (isOut ? submitCheckOut() : submitCheckIn())}
          className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-60 ${isOut ? "bg-stone-900 dark:bg-zinc-100 dark:text-zinc-900" : "bg-amber-600"}`}
        >
          {busy ? "Saving..." : isOut ? "Submit check-out" : "Submit check-in"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
      <h1 className="text-xl font-semibold text-stone-900 dark:text-zinc-50">Attendance</h1>
      <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
        Select branch and your name, then continue.
      </p>
      <div className="mt-4 space-y-3">
        <select
          value={selectedBranchId}
          onChange={(e) => void refreshForBranch(e.target.value)}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Enter your passcode"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={() => void continueAction()}
        className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white"
      >
        Continue
      </button>
      <p className="mt-3 text-xs text-stone-500 dark:text-zinc-500">Location is captured with attendance.</p>
    </div>
  );
}
