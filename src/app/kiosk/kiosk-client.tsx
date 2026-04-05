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

  async function refreshForBranch(branchId: string, opts?: { clearEmployee?: boolean }) {
    setError(null);
    const q = new URLSearchParams({ token, branchId });
    const res = await fetch(`/api/kiosk/employees?${q.toString()}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to load branch employees");
    const list = (data.employees ?? []) as Employee[];
    setEmployees(list);
    setSelectedBranchId(data.selectedBranchId ?? branchId);
    if (opts?.clearEmployee) {
      setSelectedEmployeeId("");
    } else {
      setSelectedEmployeeId((prev) => (prev && list.some((e) => e.id === prev) ? prev : list[0]?.id ?? ""));
    }
  }

  function goToThankYouPage(mode: AttendanceFlow) {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    const q = new URLSearchParams({ mode });
    window.location.replace(`/kiosk/thank-you?${q.toString()}`);
  }

  async function resolveAttendanceAction(): Promise<"checkout" | "checkin" | null> {
    if (!selectedBranchId) {
      setError("Select a branch.");
      return null;
    }
    if (!selectedEmployeeId) {
      setError("Select your name from the list.");
      return null;
    }
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
    goToThankYouPage("checkin");
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
    goToThankYouPage("checkout");
  }

  if (step === "loading") {
    return <p className="text-muted-foreground mx-auto px-4 py-12 text-center text-sm">Loading…</p>;
  }

  if (step === "done") {
    return (
      <div className="border-border bg-card text-card-foreground mx-auto w-full max-w-md rounded-2xl border p-6 text-center shadow-sm">
        <p className="text-lg font-semibold">{error ? "Action failed" : "Done"}</p>
        <p className="text-muted-foreground mt-2 text-sm">{error ?? message ?? "Attendance recorded."}</p>
      </div>
    );
  }

  if (step === "camera") {
    return (
      <div className="mx-auto w-full max-w-md px-1 sm:px-0">
        <h1 className="text-lg font-semibold sm:text-xl">
          {attendanceFlow === "checkout" ? "Check out — take a selfie" : "Check in — take a selfie"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {selectedEmployee?.name ?? "Employee"} at {selectedEmployee?.branch.name ?? "Branch"}
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="aspect-[3/4] w-full object-cover" />
        </div>
        <button
          type="button"
          onClick={capture}
          className="bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85 mt-4 min-h-12 w-full rounded-xl px-4 py-3 text-sm font-medium"
        >
          Capture selfie
        </button>
      </div>
    );
  }

  if (step === "confirm") {
    const isOut = attendanceFlow === "checkout";
    return (
      <div className="mx-auto w-full max-w-md px-1 sm:px-0">
        <h1 className="text-lg font-semibold sm:text-xl">{isOut ? "Confirm check-out" : "Confirm check-in"}</h1>
        {isOut && (
          <div className="text-muted-foreground mt-2 space-y-0.5 text-sm">
            <p>{selectedEmployee?.company.name ?? "-"} · {selectedEmployee?.branch.name ?? "-"}</p>
            <p className="text-foreground font-medium">{selectedEmployee?.name ?? "-"} · {(selectedEmployee?.role ?? "OTHER").replaceAll("_", " ")}</p>
          </div>
        )}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selfie preview" className="mt-4 w-full rounded-2xl object-cover" />
        )}
        {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void (isOut ? submitCheckOut() : submitCheckIn())}
          className={`mt-4 min-h-12 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-60 ${isOut ? "bg-foreground text-background hover:opacity-90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
        >
          {busy ? "Saving…" : isOut ? "Submit check-out" : "Submit check-in"}
        </button>
      </div>
    );
  }

  return (
    <div className="border-border bg-card text-card-foreground mx-auto w-full max-w-md rounded-2xl border p-4 shadow-sm sm:p-6">
      <h1 className="text-lg font-semibold sm:text-xl">Attendance</h1>
      <p className="text-muted-foreground mt-1 text-sm">Select branch and your name, then continue.</p>
      <div className="mt-4 space-y-3">
        <select
          value={selectedBranchId}
          onChange={(e) => void refreshForBranch(e.target.value)}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-11 w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
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
          className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-11 w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <option value="">Select your name</option>
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
          className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-11 w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
      {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
      <button
        type="button"
        onClick={() => void continueAction()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 min-h-12 w-full rounded-xl px-4 py-3 text-sm font-medium"
      >
        Continue
      </button>
      <p className="text-muted-foreground mt-3 text-xs">Location is captured with attendance.</p>
    </div>
  );
}
