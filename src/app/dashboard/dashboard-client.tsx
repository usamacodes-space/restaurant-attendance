"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "companies" | "branches" | "employees" | "qr" | "hours" | "logs";

type Company = { id: string; name: string; _count?: { branches: number; employees: number } };
type Branch = {
  id: string;
  name: string;
  companyId: string;
  company?: { id: string; name: string };
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
};
type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
  notes: string | null;
  user: { email: string; isActive: boolean };
  branch?: { id: string; name: string };
};
type AttendanceLogRow = {
  id: string;
  employeeName: string;
  branch: string;
  checkInAt: string;
  checkOutAt: string;
  checkInLatitude: number | "";
  checkInLongitude: number | "";
};

const sectionClass =
  "rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:shadow-none";

export function DashboardClient() {
  const { data } = useSession();
  const role = data?.user?.role;
  const [tab, setTab] = useState<Tab>(role === "MASTER_ADMIN" ? "companies" : "employees");

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: "companies", label: "Companies", visible: role === "MASTER_ADMIN" },
    { id: "branches", label: "Branches", visible: role !== "EMPLOYEE" },
    { id: "employees", label: "Employees", visible: role !== "EMPLOYEE" },
    { id: "qr", label: "Check-in QR", visible: role !== "EMPLOYEE" },
    { id: "hours", label: "Hours", visible: role !== "EMPLOYEE" },
    { id: "logs", label: "Attendance Logs", visible: role !== "EMPLOYEE" },
  ];

  return (
    <div className="min-h-full flex-1">
      <header className="border-b border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-stone-900 dark:text-zinc-50">WAQT Attendance Dashboard</h1>
            <p className="text-sm text-stone-500 dark:text-zinc-400">{role?.replace("_", " ") ?? "Admin"}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-amber-700 hover:underline dark:text-amber-400">
              Home
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto border-t border-stone-100 px-4 dark:border-zinc-800">
          {tabs
            .filter((t) => t.visible)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "border-amber-600 text-amber-800 dark:border-amber-500 dark:text-amber-300"
                    : "border-transparent text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {t.label}
              </button>
            ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {tab === "companies" && <CompaniesSection />}
        {tab === "branches" && <BranchesSection />}
        {tab === "employees" && <EmployeesSection />}
        {tab === "qr" && <QrSection />}
        {tab === "hours" && <HoursSection />}
        {tab === "logs" && <LogsSection />}
      </main>
    </div>
  );
}

function CompaniesSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/companies");
    const data = await res.json();
    if (res.ok) setCompanies(data.companies);
    else setError(data.error ?? "Failed to load companies");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, adminEmail: adminEmail || undefined, adminPassword: adminPassword || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed");
    setName("");
    setAdminEmail("");
    setAdminPassword("");
    void load();
  }

  return (
    <section className={sectionClass}>
      <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Companies (Master Admin)</h2>
      <form onSubmit={createCompany} className="mt-4 grid gap-3 md:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Company admin email" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Company admin password" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white">Add</button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ul className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800">
        {companies.map((c) => (
          <li key={c.id} className="py-2 text-sm text-stone-800 dark:text-zinc-100">
            {c.name} (branches: {c._count?.branches ?? 0}, employees: {c._count?.employees ?? 0})
          </li>
        ))}
      </ul>
    </section>
  );
}

function BranchesSection() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([fetch("/api/admin/branches"), fetch("/api/admin/companies")]);
    const bData = await bRes.json();
    const cData = await cRes.json();
    if (bRes.ok) setBranches(bData.branches);
    if (cRes.ok) {
      setCompanies(cData.companies);
      if (!companyId && cData.companies?.length) setCompanyId(cData.companies[0].id);
    }
    if (!bRes.ok) setError(bData.error ?? "Failed loading branches");
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createBranch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        companyId,
        radiusMeters,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed");
    setName("");
    void load();
  }

  return (
    <section className={sectionClass}>
      <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Branches</h2>
      <form onSubmit={createBranch} className="mt-4 grid gap-3 md:grid-cols-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Branch name" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100">{companies.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
        <input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Latitude" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Longitude" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <div className="flex gap-2"><input type="number" min={1} value={radiusMeters} onChange={(e) => setRadiusMeters(Number(e.target.value || 100))} className="w-24 rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" /><button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white">Add</button></div>
      </form>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ul className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800">{branches.map((b) => <li key={b.id} className="py-2 text-sm text-stone-800 dark:text-zinc-100">{b.name} ({b.company?.name ?? "-"}) [{b.latitude ?? "-"}, {b.longitude ?? "-"}] {b.radiusMeters}m</li>)}</ul>
    </section>
  );
}

function EmployeesSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", branchId: "", employeeCode: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [eRes, bRes] = await Promise.all([fetch("/api/admin/employees"), fetch("/api/admin/branches")]);
    const eData = await eRes.json();
    const bData = await bRes.json();
    if (eRes.ok) setEmployees(eData.employees);
    if (bRes.ok) {
      setBranches(bData.branches);
      setForm((prev) => ({ ...prev, branchId: prev.branchId || bData.branches?.[0]?.id || "" }));
    }
    if (!eRes.ok) setError(eData.error ?? "Failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed");
    setForm({ name: "", email: "", password: "", branchId: form.branchId, employeeCode: "", notes: "" });
    void load();
  }

  return (
    <section className={sectionClass}>
      <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Employees</h2>
      <form onSubmit={createEmployee} className="mt-4 grid gap-3 md:grid-cols-3">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="Employee code" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <button className="md:col-span-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white">Create employee</button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ul className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800">{employees.map((e) => <li key={e.id} className="py-2 text-sm text-stone-800 dark:text-zinc-100">{e.name} | {e.user.email} | {e.branch?.name ?? "-"} | {e.user.isActive ? "Active" : "Disabled"}</li>)}</ul>
    </section>
  );
}

function QrSection() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/branches").then((r) => r.json()).then((d) => {
      setBranches(d.branches ?? []);
      if ((d.branches ?? []).length > 0) setBranchId(d.branches[0].id);
    });
  }, []);

  const kioskUrl = useMemo(() => {
    if (!token || typeof window === "undefined") return "";
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || window.location.origin;
    return `${base}/kiosk?token=${encodeURIComponent(token)}`;
  }, [token]);

  useEffect(() => {
    if (!kioskUrl) {
      setDataUrl(null);
      return;
    }
    void QRCode.toDataURL(kioskUrl, { width: 300, margin: 2, errorCorrectionLevel: "M", color: { dark: "#111827", light: "#ffffff" } }).then(setDataUrl);
  }, [kioskUrl]);

  async function generate() {
    setError(null);
    const res = await fetch("/api/admin/kiosk-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed");
    setToken(data.token);
    setExpiresAt(data.expiresAt);
  }

  return (
    <section className={sectionClass}>
      <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Branch QR</h2>
      <div className="mt-4 flex gap-3">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <button onClick={() => void generate()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white">New QR</button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {dataUrl && <div className="mt-5 flex flex-col items-center gap-2">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={dataUrl} alt="QR" className="rounded-xl border border-stone-200 bg-white p-4 dark:border-zinc-600" />{expiresAt && <p className="text-xs text-stone-500">Expires: {new Date(expiresAt).toLocaleString()}</p>}</div>}
    </section>
  );
}

function HoursSection() {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [week, setWeek] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<{ employeeId: string; name: string; hours: number }[]>([]);

  useEffect(() => { void fetch("/api/admin/branches").then((r) => r.json()).then((d) => { setBranches(d.branches ?? []); if ((d.branches ?? []).length) setBranchId(d.branches[0].id); }); }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ mode });
    if (mode === "week") params.set("week", week);
    else params.set("month", month);
    if (branchId) params.set("branchId", branchId);
    const res = await fetch(`/api/admin/hours?${params.toString()}`);
    const data = await res.json();
    if (res.ok) setRows(data.rows ?? []);
  }, [mode, week, month, branchId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className={sectionClass}>
      <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Hours</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <button onClick={() => setMode("week")} className={`rounded-lg px-3 py-2 text-sm ${mode === "week" ? "bg-amber-600 text-white" : "bg-stone-100 dark:bg-zinc-800"}`}>Week</button>
        <button onClick={() => setMode("month")} className={`rounded-lg px-3 py-2 text-sm ${mode === "month" ? "bg-amber-600 text-white" : "bg-stone-100 dark:bg-zinc-800"}`}>Month</button>
        {mode === "week" ? <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" /> : <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />}
      </div>
      <ul className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800">{rows.map((r) => <li key={r.employeeId} className="py-2 text-sm text-stone-800 dark:text-zinc-100">{r.name}: {r.hours.toFixed(2)}h</li>)}</ul>
    </section>
  );
}

function LogsSection() {
  const [rows, setRows] = useState<AttendanceLogRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    void Promise.all([fetch("/api/admin/branches"), fetch("/api/admin/employees")]).then(async ([b, e]) => [await b.json(), await e.json()] as const).then(([bData, eData]) => {
      setBranches(bData.branches ?? []);
      setEmployees(eData.employees ?? []);
    });
  }, []);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (branchId) p.set("branchId", branchId);
    if (employeeId) p.set("employeeId", employeeId);
    const res = await fetch(`/api/admin/attendance-logs?${p.toString()}`);
    const data = await res.json();
    if (res.ok) setRows(data.rows ?? []);
  }, [from, to, branchId, employeeId]);

  useEffect(() => { void load(); }, [load]);

  const csvParams = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(branchId ? { branchId } : {}), ...(employeeId ? { employeeId } : {}), format: "csv" });
  const xlsxParams = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(branchId ? { branchId } : {}), ...(employeeId ? { employeeId } : {}), format: "xlsx" });

  return (
    <section className={sectionClass}>
      <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Attendance Logs</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"><option value="">All employees</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <div className="flex gap-2"><a href={`/api/admin/attendance-logs?${csvParams.toString()}`} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">CSV</a><a href={`/api/admin/attendance-logs?${xlsxParams.toString()}`} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">Excel</a></div>
      </div>
      <div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-stone-500"><tr><th className="py-2">Employee</th><th>Branch</th><th>Check-in</th><th>Check-out</th><th>Location</th></tr></thead><tbody className="divide-y divide-stone-100 dark:divide-zinc-800">{rows.map((r) => <tr key={r.id}><td className="py-2 text-stone-900 dark:text-zinc-100">{r.employeeName}</td><td>{r.branch}</td><td>{r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "-"}</td><td>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : "-"}</td><td>{r.checkInLatitude || "-"}, {r.checkInLongitude || "-"}</td></tr>)}</tbody></table></div>
    </section>
  );
}
