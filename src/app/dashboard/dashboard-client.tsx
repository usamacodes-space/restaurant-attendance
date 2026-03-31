 "use client";

import { signOut, useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

type Tab = "companies" | "branches" | "employees" | "company" | "hours" | "logs";
type Company = { id: string; name: string; _count?: { branches: number; employees: number }; companyAdminEmail?: string | null };
type Branch = {
  id: string;
  name: string;
  companyId: string;
  company?: { id: string; name: string };
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  _count?: { employees: number };
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
  checkInSelfieUrl?: string;
  branch: string;
  checkInAt: string;
  checkOutAt: string;
  checkInLatitude: number | "";
  checkInLongitude: number | "";
  locationStatus?: string;
  distanceMeters?: number | "";
  branchRadiusMeters?: number;
};

const sectionClass =
  "rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:shadow-none";
const BranchLocationPicker = dynamic(
  () => import("./branch-location-picker").then((m) => m.BranchLocationPicker),
  { ssr: false }
);

export function DashboardClient() {
  const { data } = useSession();
  const role = data?.user?.role;
  const [tab, setTab] = useState<Tab>("companies");

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: "companies", label: "Companies", visible: role === "MASTER_ADMIN" },
    { id: "branches", label: "Branches", visible: role === "MASTER_ADMIN" },
    { id: "employees", label: "All Employees", visible: false },
    { id: "company", label: "Company Workspace", visible: role === "COMPANY_ADMIN" },
    { id: "hours", label: "Hours", visible: role === "COMPANY_ADMIN" },
    { id: "logs", label: "Attendance Logs", visible: role === "COMPANY_ADMIN" },
  ];

  useEffect(() => {
    if (!role) return;
    if (role === "MASTER_ADMIN") {
      if (tab !== "companies" && tab !== "branches") setTab("companies");
      return;
    }
    if (role === "COMPANY_ADMIN") {
      if (tab !== "company" && tab !== "hours" && tab !== "logs") setTab("company");
    }
  }, [role, tab]);

  return (
    <div className="min-h-full flex-1">
      <header className="border-b border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-stone-900 dark:text-zinc-50">WAQT Attendance Dashboard</h1>
            <p className="text-sm text-stone-500 dark:text-zinc-400">{role?.replace("_", " ") ?? "Admin"}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login?callbackUrl=%2Fdashboard" })}
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
        {tab === "company" && <CompanyWorkspaceSection />}
        {tab === "hours" && <HoursSection />}
        {tab === "logs" && <LogsSection />}
      </main>
    </div>
  );
}

function CompaniesSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [adminEmailDrafts, setAdminEmailDrafts] = useState<Record<string, string>>({});
  const [adminPasswordDrafts, setAdminPasswordDrafts] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/companies");
    const data = await res.json();
    if (res.ok) {
      setCompanies(data.companies);
      setCompanyNames(
        Object.fromEntries((data.companies as Company[]).map((c) => [c.id, c.name]))
      );
      setAdminEmailDrafts(
        Object.fromEntries(
          (data.companies as Company[]).map((c) => [c.id, c.companyAdminEmail ?? ""])
        )
      );
      setAdminPasswordDrafts({});
    }
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2">
                <input
                  value={companyNames[c.id] ?? c.name}
                  onChange={(e) => setCompanyNames((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className="w-full max-w-sm rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const newName = (companyNames[c.id] ?? "").trim();
                    if (!newName) return setError("Company name is required");
                    const res = await fetch(`/api/admin/companies/${c.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newName }),
                    });
                    if (res.ok) void load();
                    else {
                      const d = await res.json().catch(() => ({ error: "Update failed" }));
                      setError(d.error ?? "Update failed");
                    }
                  }}
                  className="rounded-lg border border-stone-300 px-3 py-1 text-xs text-stone-700 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Save company
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 dark:text-zinc-400">
                  branches: {c._count?.branches ?? 0}, employees: {c._count?.employees ?? 0}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Delete this company and all related data?")) return;
                    const res = await fetch(`/api/admin/companies/${c.id}`, { method: "DELETE" });
                    if (res.ok) void load();
                    else {
                      const d = await res.json().catch(() => ({ error: "Delete failed" }));
                      setError(d.error ?? "Delete failed");
                    }
                  }}
                  className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700 dark:border-red-900/50 dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-5 items-center">
              <input
                value={adminEmailDrafts[c.id] ?? c.companyAdminEmail ?? ""}
                onChange={(e) => setAdminEmailDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="Company admin email"
                className="md:col-span-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <input
                type="password"
                value={adminPasswordDrafts[c.id] ?? ""}
                onChange={(e) => setAdminPasswordDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="New password (leave blank to keep)"
                className="md:col-span-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={async () => {
                  const email = (adminEmailDrafts[c.id] ?? c.companyAdminEmail ?? "").trim();
                  const password = adminPasswordDrafts[c.id] ?? "";
                  if (!email && !password) return setError("Provide email and/or new password.");
                  const res = await fetch(`/api/admin/companies/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      adminEmail: email || undefined,
                      adminPassword: password || undefined,
                    }),
                  });
                  if (res.ok) void load();
                  else {
                    const d = await res.json().catch(() => ({ error: "Update failed" }));
                    setError(d.error ?? "Update failed");
                  }
                }}
                className="md:col-span-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white dark:bg-amber-500"
              >
                Save admin
              </button>
            </div>
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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRadius, setEditRadius] = useState(100);
  const [editLatitude, setEditLatitude] = useState<number | null>(null);
  const [editLongitude, setEditLongitude] = useState<number | null>(null);
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
        latitude: latitude,
        longitude: longitude,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed");
    setName("");
    setLatitude(null);
    setLongitude(null);
    void load();
  }

  return (
    <section className={sectionClass}>
      <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Branches (Super Admin only)</h2>
      <form onSubmit={createBranch} className="mt-4 grid gap-3 md:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Branch name" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100">{companies.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
        <div className="md:col-span-2">
          <BranchLocationPicker
            latitude={latitude}
            longitude={longitude}
            radiusMeters={radiusMeters}
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
          <p className="mt-2 text-xs text-stone-500 dark:text-zinc-400">
            Selected: {latitude?.toFixed(6) ?? "-"}, {longitude?.toFixed(6) ?? "-"}
          </p>
        </div>
        <div className="md:col-span-2 flex items-center gap-2">
          <input type="number" min={1} value={radiusMeters} onChange={(e) => setRadiusMeters(Number(e.target.value || 100))} className="w-32 rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
          <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white">Add branch</button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ul className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800">
        {branches.map((b) => (
          <li key={b.id} className="py-3 text-sm text-stone-800 dark:text-zinc-100">
            <div className="flex items-center justify-between">
              <span>
                {b.name} ({b.company?.name ?? "-"}) [{b.latitude ?? "-"}, {b.longitude ?? "-"}] {b.radiusMeters}m
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBranchId(b.id);
                    setEditName(b.name);
                    setEditRadius(b.radiusMeters);
                    setEditLatitude(b.latitude);
                    setEditLongitude(b.longitude);
                  }}
                  className="rounded-lg border border-stone-300 px-3 py-1 text-xs text-stone-700 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Edit settings
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Delete this branch?")) return;
                    const res = await fetch(`/api/admin/branches/${b.id}`, { method: "DELETE" });
                    if (res.ok) void load();
                    else {
                      const d = await res.json().catch(() => ({ error: "Delete failed" }));
                      setError(d.error ?? "Delete failed");
                    }
                  }}
                  className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700 dark:border-red-900/50 dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
            {editingBranchId === b.id && (
              <div className="mt-3 rounded-xl border border-stone-200 p-3 dark:border-zinc-700">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <input
                    type="number"
                    min={1}
                    value={editRadius}
                    onChange={(e) => setEditRadius(Number(e.target.value || 100))}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div className="mt-3">
                  <BranchLocationPicker
                    latitude={editLatitude}
                    longitude={editLongitude}
                    radiusMeters={editRadius}
                    onChange={(lat, lng) => {
                      setEditLatitude(lat);
                      setEditLongitude(lng);
                    }}
                  />
                  <p className="mt-2 text-xs text-stone-500 dark:text-zinc-400">
                    Selected: {editLatitude?.toFixed(6) ?? "-"}, {editLongitude?.toFixed(6) ?? "-"}
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch(`/api/admin/branches/${b.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: editName,
                          radiusMeters: editRadius,
                          latitude: editLatitude,
                          longitude: editLongitude,
                        }),
                      });
                      if (res.ok) {
                        setEditingBranchId(null);
                        void load();
                      } else {
                        const d = await res.json().catch(() => ({ error: "Update failed" }));
                        setError(d.error ?? "Update failed");
                      }
                    }}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Save settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBranchId(null)}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-700 dark:border-zinc-600 dark:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
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
      <ul className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800">
        {employees.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-3 text-sm text-stone-800 dark:text-zinc-100">
            <div className="grid gap-1">
              <p className="font-medium">{e.name}</p>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                {e.user.email} | {e.branch?.name ?? "-"} | {e.user.isActive ? "Active" : "Disabled"}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Remove this employee?")) return;
                const res = await fetch(`/api/admin/employees/${e.id}`, { method: "DELETE" });
                if (res.ok) void load();
                else {
                  const d = await res.json().catch(() => ({ error: "Delete failed" }));
                  setError(d.error ?? "Delete failed");
                }
              }}
              className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700 dark:border-red-900/50 dark:text-red-400"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompanyWorkspaceSection() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", branchId: "", employeeCode: "", notes: "" });
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

  useEffect(() => {
    if (!branches.length) return;
    const missing = branches.filter((b) => !qrByBranch[b.id]).map((b) => b.id);
    if (!missing.length) return;
    missing.forEach((id) => {
      void generateQr(id);
    });
    // we intentionally react to branches/qr map to keep one active QR per branch
  }, [branches, qrByBranch]);

  useEffect(() => {
    if (!branches.length) return;
    const t = window.setInterval(() => {
      const now = Date.now();
      branches.forEach((b) => {
        const item = qrByBranch[b.id];
        if (!item) return;
        const exp = Date.parse(item.expiresAt);
        if (Number.isFinite(exp) && exp <= now + 5000) {
          void generateQr(b.id);
        }
      });
    }, 5000);
    return () => window.clearInterval(t);
  }, [branches, qrByBranch]);

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
    setForm({ name: "", email: "", password: "", branchId: "", employeeCode: "", notes: "" });
    void load();
  }

  async function generateQr(branchId: string) {
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
      return setError(data.error ?? "Failed generating QR");
    }
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || window.location.origin;
    const kioskUrl = `${base}/kiosk?token=${encodeURIComponent(data.token)}`;
    const dataUrl = await QRCode.toDataURL(kioskUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    });
    const branchName = branches.find((b) => b.id === branchId)?.name ?? "";
    const publicUrl = `${base}/qr?token=${encodeURIComponent(data.token)}&expiresAt=${encodeURIComponent(
      data.expiresAt
    )}&branch=${encodeURIComponent(branchName)}`;
    setQrByBranch((prev) => ({ ...prev, [branchId]: { dataUrl, expiresAt: data.expiresAt, publicUrl } }));
    setQrLoadingByBranch((prev) => ({ ...prev, [branchId]: false }));
  }

  return (
    <div className="space-y-6">
      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Company Branches & QR</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
          QR expiry is enforced to 1-2 hours globally.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {branches.map((b) => (
            <div key={b.id} className="rounded-xl border border-stone-200 p-4 dark:border-zinc-700">
              <p className="font-medium text-stone-900 dark:text-zinc-100">{b.name}</p>
              <p className="text-xs text-stone-500 dark:text-zinc-500">
                Employees: {b._count?.employees ?? 0} - Radius: {b.radiusMeters}m
              </p>
              <p className="mt-3 text-xs text-stone-500 dark:text-zinc-500">QR auto-refreshes on expiry.</p>
              {qrLoadingByBranch[b.id] && <p className="mt-2 text-xs text-stone-500 dark:text-zinc-500">Generating QR...</p>}
              {qrByBranch[b.id] && (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrByBranch[b.id].dataUrl} alt={`${b.name} QR`} className="h-24 w-24 rounded border border-stone-200 bg-white p-1 dark:border-zinc-600" />
                  <div className="space-y-2">
                    <p className="text-xs text-stone-500 dark:text-zinc-500">
                      Expires: {new Date(qrByBranch[b.id].expiresAt).toLocaleString()}
                    </p>
                    <a
                      href={qrByBranch[b.id].publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Open external QR page
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Add Employee (branch-scoped)</h2>
        <form onSubmit={createEmployee} autoComplete="off" className="mt-4 grid gap-3 md:grid-cols-3">
          <input autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
          <input autoComplete="new-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
          <input autoComplete="new-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
          <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input autoComplete="off" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="Employee code" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
          <input autoComplete="off" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
          <button className="md:col-span-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white dark:bg-amber-500">Create employee</button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-50">Employee Details</h2>
        <ul className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800">
          {employees.map((e) => (
            <li key={e.id} className="py-3 text-sm text-stone-800 dark:text-zinc-100">
              <p className="font-medium">{e.name}</p>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                {e.user.email} | {e.branch?.name ?? "-"} | {e.user.isActive ? "Active" : "Disabled"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
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
      <TableContainer component={Paper} sx={{ mt: 2, borderRadius: 3, bgcolor: "transparent" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Photo</TableCell>
              <TableCell>Employee</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Check-in</TableCell>
              <TableCell>Check-out</TableCell>
              <TableCell>Location</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const statusColor =
                r.locationStatus === "Matched" ? "success" : r.locationStatus === "Outside branch radius" ? "error" : "default";
              return (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Avatar
                      src={r.checkInSelfieUrl || undefined}
                      alt={r.employeeName}
                      sx={{ width: 38, height: 38 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{r.employeeName}</TableCell>
                  <TableCell>{r.branch}</TableCell>
                  <TableCell>{r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "-"}</TableCell>
                  <TableCell>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : "-"}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Chip size="small" label={r.locationStatus ?? "Unknown"} color={statusColor} variant="filled" />
                      <p className="text-xs text-stone-500 dark:text-zinc-400">
                        {r.checkInLatitude || "-"}, {r.checkInLongitude || "-"}
                      </p>
                      {typeof r.distanceMeters === "number" && typeof r.branchRadiusMeters === "number" && (
                        <p className="text-xs text-stone-500 dark:text-zinc-400">
                          Distance: {r.distanceMeters}m / Radius: {r.branchRadiusMeters}m
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}
