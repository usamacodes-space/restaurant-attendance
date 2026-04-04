"use client";

import QRCode from "qrcode";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Branch, Company, Employee, EmployeeRole } from "../types";
import { EMPLOYEE_ROLE_OPTIONS, primaryButtonClass } from "../types";

export function CompanyWorkspaceSection() {
  const [company, setCompany] = useState<Company | null>(null);
  const [draftCompanyLogoUrl, setDraftCompanyLogoUrl] = useState("");
  const [draftSheetId, setDraftSheetId] = useState("");
  const [draftSheetTab, setDraftSheetTab] = useState("Attendance");
  const [busySheets, setBusySheets] = useState(false);
  const [busyCompanyLogo, setBusyCompanyLogo] = useState<false | "upload" | "save">(false);
  const companyLogoFileRef = useRef<HTMLInputElement>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    branchId: "",
    employeeCode: "",
    notes: "",
    role: "OTHER" as EmployeeRole,
    shiftStart: "",
    shiftEnd: "",
  });
  const [shiftDrafts, setShiftDrafts] = useState<Record<string, { start: string; end: string }>>({});
  const [shiftSavingId, setShiftSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrByBranch, setQrByBranch] = useState<
    Record<string, { dataUrl: string; expiresAt: string; publicUrl: string }>
  >({});
  const [qrLoadingByBranch, setQrLoadingByBranch] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [bRes, eRes, cRes] = await Promise.all([
      fetch("/api/admin/branches"),
      fetch("/api/admin/employees"),
      fetch("/api/admin/companies"),
    ]);
    const bData = await bRes.json();
    const eData = await eRes.json();
    const cData = cRes.ok ? await cRes.json() : {};
    if (bRes.ok) {
      const nextBranches = (bData.branches ?? []) as Branch[];
      setBranches(nextBranches);
      setForm((p) => {
        const hasCurrent = nextBranches.some((b) => b.id === p.branchId);
        return { ...p, branchId: hasCurrent ? p.branchId : (nextBranches[0]?.id ?? "") };
      });
    } else setError(bData.error ?? "Failed loading branches");
    if (eRes.ok) {
      const list = (eData.employees ?? []) as Employee[];
      setEmployees(list);
      setShiftDrafts(
        Object.fromEntries(list.map((x) => [x.id, { start: x.shiftStartTime ?? "", end: x.shiftEndTime ?? "" }]))
      );
    } else setError(eData.error ?? "Failed loading employees");
    if (cRes.ok) {
      const list = (cData.companies ?? []) as Company[];
      const co = list[0] ?? null;
      setCompany(co);
      setDraftCompanyLogoUrl(co?.qrCompanyLogoUrl ?? "");
      setDraftSheetId(co?.attendanceGoogleSpreadsheetId ?? "");
      setDraftSheetTab(co?.attendanceGoogleSheetTabName?.trim() || "Attendance");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generateQr = useCallback(async (branchId: string) => {
    setError(null);
    setQrLoadingByBranch((prev) => ({ ...prev, [branchId]: true }));
    const res = await fetch("/api/admin/kiosk-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setQrLoadingByBranch((prev) => ({ ...prev, [branchId]: false }));
      setError(data.error ?? "Failed generating QR");
      return;
    }
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || window.location.origin;
    const kioskUrl = `${base}/kiosk?branchId=${encodeURIComponent(branchId)}`;
    const dataUrl = await QRCode.toDataURL(kioskUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    });
    const publicUrl = `${base}/qr?branchId=${encodeURIComponent(branchId)}`;
    setQrByBranch((prev) => ({ ...prev, [branchId]: { dataUrl, expiresAt: data.expiresAt, publicUrl } }));
    setQrLoadingByBranch((prev) => ({ ...prev, [branchId]: false }));
  }, []);

  useEffect(() => {
    if (!branches.length) return;
    const missing = branches.filter((b) => !qrByBranch[b.id]).map((b) => b.id);
    if (!missing.length) return;
    missing.forEach((id) => void generateQr(id));
  }, [branches, qrByBranch, generateQr]);

  useEffect(() => {
    if (!branches.length) return;
    const t = window.setInterval(() => {
      const now = Date.now();
      branches.forEach((b) => {
        const item = qrByBranch[b.id];
        if (!item) return;
        const exp = Date.parse(item.expiresAt);
        if (Number.isFinite(exp) && exp <= now + 5000) void generateQr(b.id);
      });
    }, 5000);
    return () => window.clearInterval(t);
  }, [branches, qrByBranch, generateQr]);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { shiftStart, shiftEnd, ...rest } = form;
    const st = shiftStart.trim();
    const en = shiftEnd.trim();
    if ((st && !en) || (!st && en)) {
      setError("Enter both shift start and end, or leave both empty.");
      return;
    }
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...rest,
        ...(st && en ? { shiftStartTime: st, shiftEndTime: en } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed");
    setForm({
      name: "",
      email: "",
      password: "",
      branchId: branches[0]?.id ?? "",
      employeeCode: "",
      notes: "",
      role: "OTHER",
      shiftStart: "",
      shiftEnd: "",
    });
    void load();
  }

  async function saveEmployeeShift(employeeId: string) {
    const draft = shiftDrafts[employeeId];
    if (!draft) return;
    setError(null);
    setShiftSavingId(employeeId);
    const res = await fetch(`/api/admin/employees/${encodeURIComponent(employeeId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftStartTime: draft.start.trim() || null,
        shiftEndTime: draft.end.trim() || null,
      }),
    });
    const data = await res.json();
    setShiftSavingId(null);
    if (!res.ok) return setError(data.error ?? "Failed to save shift");
    void load();
  }

  async function uploadCompanyLogoFile(file: File | undefined) {
    if (!file || !company) return;
    setError(null);
    setBusyCompanyLogo("upload");
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/admin/companies/${company.id}/qr-logo/upload`, { method: "POST", body: fd });
    const data = await res.json();
    setBusyCompanyLogo(false);
    if (!res.ok) return setError(data.error ?? "Upload failed");
    setCompany((c) => (c ? { ...c, qrCompanyLogoUrl: data.qrCompanyLogoUrl ?? data.url } : c));
    setDraftCompanyLogoUrl(data.qrCompanyLogoUrl ?? data.url ?? "");
  }

  async function saveGoogleSheetSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setError(null);
    setBusySheets(true);
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendanceGoogleSpreadsheetId: draftSheetId.trim() || null,
        attendanceGoogleSheetTabName: draftSheetTab.trim() || null,
      }),
    });
    const data = await res.json();
    setBusySheets(false);
    if (!res.ok) return setError(data.error ?? "Save failed");
    const c = data.company;
    if (c) {
      setCompany((prev) =>
        prev
          ? {
              ...prev,
              attendanceGoogleSpreadsheetId: c.attendanceGoogleSpreadsheetId ?? null,
              attendanceGoogleSheetTabName: c.attendanceGoogleSheetTabName ?? null,
            }
          : prev
      );
      setDraftSheetId(c.attendanceGoogleSpreadsheetId ?? "");
      setDraftSheetTab(c.attendanceGoogleSheetTabName?.trim() || "Attendance");
    }
  }

  async function saveCompanyLogoUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setError(null);
    setBusyCompanyLogo("save");
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCompanyLogoUrl: draftCompanyLogoUrl.trim() || null }),
    });
    const data = await res.json();
    setBusyCompanyLogo(false);
    if (!res.ok) return setError(data.error ?? "Save failed");
    const u = data.company?.qrCompanyLogoUrl ?? null;
    setCompany((prev) => (prev ? { ...prev, qrCompanyLogoUrl: u } : prev));
    setDraftCompanyLogoUrl(u ?? "");
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <Card className="border-border shadow-md">
        <CardHeader className="px-4 pt-6 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Company logo on QR page</CardTitle>
          <CardDescription>
            Shown on the right of the × next to the global WAQT logo on every branch QR page for your company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
          {!company ? (
            <p className="text-muted-foreground text-sm">Loading company…</p>
          ) : (
            <>
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
                {company.qrCompanyLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.qrCompanyLogoUrl} alt="" className="max-h-full max-w-full object-contain p-1" />
                ) : (
                  <span className="text-muted-foreground px-2 text-center text-xs">No company logo</span>
                )}
              </div>
              <input
                ref={companyLogoFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void uploadCompanyLogoFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyCompanyLogo !== false}
                onClick={() => companyLogoFileRef.current?.click()}
              >
                {busyCompanyLogo === "upload" ? "Uploading…" : "Upload image"}
              </Button>
              <form onSubmit={saveCompanyLogoUrl} className="max-w-xl space-y-2">
                <Label htmlFor="co-qr-url">Or image URL</Label>
                <Input
                  id="co-qr-url"
                  value={draftCompanyLogoUrl}
                  onChange={(e) => setDraftCompanyLogoUrl(e.target.value)}
                  placeholder="https://…"
                />
                <Button type="submit" disabled={busyCompanyLogo !== false} className={primaryButtonClass}>
                  {busyCompanyLogo === "save" ? "Saving…" : "Save URL"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-md">
        <CardHeader className="px-4 pt-6 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Google Sheets</CardTitle>
          <CardDescription>
            Push attendance log exports (same columns as CSV, no selfie URLs) to a spreadsheet. The server uses a
            Google service account: share your sheet with that account as Editor. Set{" "}
            <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_JSON</code> on the server (full JSON key).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
          {!company ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <form onSubmit={saveGoogleSheetSettings} className="max-w-xl space-y-3">
              <div className="space-y-2">
                <Label htmlFor="co-sheet-id">Spreadsheet ID or URL</Label>
                <Input
                  id="co-sheet-id"
                  value={draftSheetId}
                  onChange={(e) => setDraftSheetId(e.target.value)}
                  placeholder="1AbC… or https://docs.google.com/spreadsheets/d/…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-sheet-tab">Worksheet tab name</Label>
                <Input
                  id="co-sheet-tab"
                  value={draftSheetTab}
                  onChange={(e) => setDraftSheetTab(e.target.value)}
                  placeholder="Attendance"
                />
                <p className="text-muted-foreground text-xs">
                  The tab is created if missing. Each sync replaces all rows in that tab with the current filtered logs
                  (from the Logs tab).
                </p>
              </div>
              <Button type="submit" disabled={busySheets} className={primaryButtonClass}>
                {busySheets ? "Saving…" : "Save sheet settings"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-md">
        <CardHeader className="px-4 pt-6 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Branch QR sessions</CardTitle>
          <CardDescription>Active QR pages refresh before expiry.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {branches.map((b) => (
              <div key={b.id} className="rounded-xl border border-border p-4">
                <p className="font-semibold">{b.name}</p>
                <p className="text-muted-foreground text-sm">
                  Employees: {b._count?.employees ?? 0} · Radius: {b.radiusMeters}m
                </p>
                {qrLoadingByBranch[b.id] && <p className="text-muted-foreground mt-2 text-xs">Generating QR…</p>}
                {qrByBranch[b.id] && (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrByBranch[b.id].dataUrl}
                      alt={`${b.name} QR`}
                      className="h-24 w-24 shrink-0 rounded-lg border border-border bg-white p-1"
                    />
                    <div className="min-w-0 space-y-2">
                      <p className="text-muted-foreground text-xs break-all">
                        Expires: {new Date(qrByBranch[b.id].expiresAt).toLocaleString()}
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <a href={qrByBranch[b.id].publicUrl} target="_blank" rel="noreferrer">
                          Open public QR page
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-md">
        <CardHeader className="px-4 pt-6 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Add employee</CardTitle>
          <CardDescription>
            Assign to a branch with role and login. Optional shift times use the UTC clock (same as work-hours
            reports); at checkout, early arrival becomes deduction and time after shift end becomes overtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={createEmployee} autoComplete="off" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="emp-name">Name</Label>
              <Input id="emp-name" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-email">Email</Label>
              <Input
                id="emp-email"
                autoComplete="off"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-pass">Password</Label>
              <Input
                id="emp-pass"
                autoComplete="new-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={form.branchId || undefined} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as EmployeeRole })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-code">Employee code</Label>
              <Input
                id="emp-code"
                autoComplete="off"
                value={form.employeeCode}
                onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label htmlFor="emp-notes">Notes</Label>
              <Input id="emp-notes" autoComplete="off" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-shift-start">Shift start (UTC)</Label>
              <Input
                id="emp-shift-start"
                type="time"
                value={form.shiftStart}
                onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-shift-end">Shift end (UTC)</Label>
              <Input
                id="emp-shift-end"
                type="time"
                value={form.shiftEnd}
                onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <Button type="submit" className={primaryButtonClass}>
                Create employee
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-md">
        <CardHeader className="px-4 pt-6 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Employee directory</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Edit scheduled shift (UTC); save applies to future checkouts. Leave both empty to disable auto deduction/OT.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Name</TableHead>
                  <TableHead className="min-w-[100px]">Role</TableHead>
                  <TableHead className="min-w-[160px]">Email</TableHead>
                  <TableHead className="min-w-[100px]">Branch</TableHead>
                  <TableHead className="min-w-[100px]">Shift start</TableHead>
                  <TableHead className="min-w-[100px]">Shift end</TableHead>
                  <TableHead className="min-w-[88px]"> </TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => {
                  const startVal = shiftDrafts[e.id]?.start ?? e.shiftStartTime ?? "";
                  const endVal = shiftDrafts[e.id]?.end ?? e.shiftEndTime ?? "";
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{(e.role ?? "OTHER").replaceAll("_", " ")}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{e.user.email}</TableCell>
                      <TableCell>{e.branch?.name ?? "-"}</TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          className="h-8 w-[7.25rem]"
                          value={startVal}
                          onChange={(ev) =>
                            setShiftDrafts((p) => {
                              const cur = p[e.id] ?? { start: e.shiftStartTime ?? "", end: e.shiftEndTime ?? "" };
                              return { ...p, [e.id]: { ...cur, start: ev.target.value } };
                            })
                          }
                          aria-label={`Shift start for ${e.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          className="h-8 w-[7.25rem]"
                          value={endVal}
                          onChange={(ev) =>
                            setShiftDrafts((p) => {
                              const cur = p[e.id] ?? { start: e.shiftStartTime ?? "", end: e.shiftEndTime ?? "" };
                              return { ...p, [e.id]: { ...cur, end: ev.target.value } };
                            })
                          }
                          aria-label={`Shift end for ${e.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={shiftSavingId === e.id}
                          onClick={() => void saveEmployeeShift(e.id)}
                        >
                          {shiftSavingId === e.id ? "…" : "Save shift"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.user.isActive ? "default" : "secondary"}>{e.user.isActive ? "Active" : "Disabled"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
