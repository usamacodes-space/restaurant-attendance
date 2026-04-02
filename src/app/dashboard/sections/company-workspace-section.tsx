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
import { useCallback, useEffect, useState } from "react";
import type { Branch, Employee, EmployeeRole } from "../types";
import { EMPLOYEE_ROLE_OPTIONS, primaryButtonClass } from "../types";

export function CompanyWorkspaceSection() {
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
  });
  const [error, setError] = useState<string | null>(null);
  const [qrByBranch, setQrByBranch] = useState<
    Record<string, { dataUrl: string; expiresAt: string; publicUrl: string }>
  >({});
  const [qrLoadingByBranch, setQrLoadingByBranch] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [bRes, eRes] = await Promise.all([fetch("/api/admin/branches"), fetch("/api/admin/employees")]);
    const bData = await bRes.json();
    const eData = await eRes.json();
    if (bRes.ok) {
      const nextBranches = (bData.branches ?? []) as Branch[];
      setBranches(nextBranches);
      setForm((p) => {
        const hasCurrent = nextBranches.some((b) => b.id === p.branchId);
        return { ...p, branchId: hasCurrent ? p.branchId : (nextBranches[0]?.id ?? "") };
      });
    } else setError(bData.error ?? "Failed loading branches");
    if (eRes.ok) setEmployees(eData.employees ?? []);
    else setError(eData.error ?? "Failed loading employees");
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
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed");
    setForm({ name: "", email: "", password: "", branchId: branches[0]?.id ?? "", employeeCode: "", notes: "", role: "OTHER" });
    void load();
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
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
          <CardDescription>Assign to a branch with role and login.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-6 sm:px-6">
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
                  <TableHead className="min-w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{(e.role ?? "OTHER").replaceAll("_", " ")}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{e.user.email}</TableCell>
                    <TableCell>{e.branch?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={e.user.isActive ? "default" : "secondary"}>{e.user.isActive ? "Active" : "Disabled"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
