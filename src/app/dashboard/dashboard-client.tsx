 "use client";

import dynamic from "next/dynamic";
import { signOut, useSession } from "next-auth/react";
import QRCode from "qrcode";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

type TabId = "companies" | "branches" | "company" | "hours" | "logs";
type EmployeeRole = "DRIVER" | "DELIVERY_DRIVER" | "COFFEE_MAKER" | "CASHIER" | "WAITER" | "CHEF" | "CLEANER" | "OTHER";
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
  role?: EmployeeRole;
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

const EMPLOYEE_ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "DRIVER", label: "Driver" },
  { value: "DELIVERY_DRIVER", label: "Delivery Driver" },
  { value: "COFFEE_MAKER", label: "Coffee Maker" },
  { value: "CASHIER", label: "Cashier" },
  { value: "WAITER", label: "Waiter" },
  { value: "CHEF", label: "Chef" },
  { value: "CLEANER", label: "Cleaner" },
  { value: "OTHER", label: "Other" },
];

const BranchLocationPicker = dynamic(
  () => import("./branch-location-picker").then((m) => m.BranchLocationPicker),
  { ssr: false }
);

const shellSx = {
  borderRadius: 4,
  border: "1px solid",
  borderColor: "divider",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  backgroundColor: "background.paper",
};

export function DashboardClient() {
  const { data } = useSession();
  const role = data?.user?.role;
  const [roleLabel, setRoleLabel] = useState("Admin");
  const [tab, setTab] = useState<TabId>("companies");

  const tabs = useMemo(() => {
    if (role === "MASTER_ADMIN") {
      return [
        { id: "companies" as TabId, label: "Companies" },
        { id: "branches" as TabId, label: "Branches" },
      ];
    }
    if (role === "COMPANY_ADMIN") {
      return [
        { id: "company" as TabId, label: "Workspace" },
        { id: "hours" as TabId, label: "Hours" },
        { id: "logs" as TabId, label: "Attendance Logs" },
      ];
    }
    return [];
  }, [role]);

  useEffect(() => {
    if (!tabs.length) return;
    const tabExists = tabs.some((t) => t.id === tab);
    if (!tabExists) setTab(tabs[0].id);
  }, [tab, tabs]);

  useEffect(() => {
    if (!role) {
      setRoleLabel("Admin");
      return;
    }
    if (role === "COMPANY_ADMIN") {
      void fetch("/api/admin/companies")
        .then((r) => r.json())
        .then((d) => {
          const companyName = d?.companies?.[0]?.name;
          setRoleLabel(companyName ? `${companyName} Admin` : "Company Admin");
        })
        .catch(() => setRoleLabel("Company Admin"));
      return;
    }
    setRoleLabel("Master Admin");
  }, [role]);

  return (
    <Box className="min-h-full flex-1 bg-slate-50/60 dark:bg-zinc-950">
      <Box className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Box className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <Box>
            <Typography variant="h5" fontWeight={700}>
              WAQT Attendance Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {roleLabel}
            </Typography>
          </Box>
          <Button variant="outlined" color="inherit" onClick={() => signOut({ callbackUrl: "/login?callbackUrl=%2Fdashboard" })}>
            Sign out
          </Button>
        </Box>
        <Box className="mx-auto max-w-6xl px-4">
          <Tabs
            value={tab}
            onChange={(_, value: TabId) => setTab(value)}
            variant="scrollable"
            sx={{ minHeight: 52, "& .MuiTab-root": { minHeight: 52, fontWeight: 600 } }}
          >
            {tabs.map((t) => (
              <Tab key={t.id} value={t.id} label={t.label} />
            ))}
          </Tabs>
        </Box>
      </Box>

      <Box className="mx-auto max-w-6xl px-4 py-8">
        {role === "MASTER_ADMIN" && <MasterAdminScreen tab={tab} />}
        {role === "COMPANY_ADMIN" && <CompanyAdminScreen tab={tab} />}
      </Box>
    </Box>
  );
}

function MasterAdminScreen({ tab }: { tab: TabId }) {
  return (
    <Stack spacing={3}>
      {tab === "companies" && <CompaniesSection />}
      {tab === "branches" && <BranchesSection />}
    </Stack>
  );
}

function CompanyAdminScreen({ tab }: { tab: TabId }) {
  return (
    <Stack spacing={3}>
      {tab === "company" && <CompanyWorkspaceSection />}
      {tab === "hours" && <HoursSection />}
      {tab === "logs" && <LogsSection />}
    </Stack>
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
    <Card sx={shellSx}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          Companies
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Master admin can create companies and manage each company admin credentials.
        </Typography>

        <Box component="form" onSubmit={createCompany} sx={{ mt: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr auto" } }}>
          <TextField value={name} onChange={(e) => setName(e.target.value)} label="Company name" size="small" />
          <TextField value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} label="Company admin email" size="small" />
          <TextField type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} label="Company admin password" size="small" />
          <Button type="submit" variant="contained">
            Add company
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {companies.map((c) => (
            <Paper key={c.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} alignItems={{ xs: "stretch", md: "center" }} sx={{ flex: 1 }}>
                    <TextField
                      value={companyNames[c.id] ?? c.name}
                      onChange={(e) => setCompanyNames((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      label="Company"
                      size="small"
                      sx={{ maxWidth: 360, width: "100%" }}
                    />
                    <Button
                      variant="outlined"
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
                    >
                      Save company
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={`Branches: ${c._count?.branches ?? 0}`} />
                    <Chip size="small" label={`Employees: ${c._count?.employees ?? 0}`} />
                    <Button
                      color="error"
                      variant="outlined"
                      onClick={async () => {
                        if (!confirm("Delete this company and all related data?")) return;
                        const res = await fetch(`/api/admin/companies/${c.id}`, { method: "DELETE" });
                        if (res.ok) void load();
                        else {
                          const d = await res.json().catch(() => ({ error: "Delete failed" }));
                          setError(d.error ?? "Delete failed");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </Stack>
                </Stack>

                <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1.25fr 1.25fr auto" } }}>
                  <TextField
                    value={adminEmailDrafts[c.id] ?? c.companyAdminEmail ?? ""}
                    onChange={(e) => setAdminEmailDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    label="Company admin email"
                    size="small"
                  />
                  <TextField
                    type="password"
                    value={adminPasswordDrafts[c.id] ?? ""}
                    onChange={(e) => setAdminPasswordDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    label="New password (optional)"
                    size="small"
                  />
                  <Button
                    variant="contained"
                    onClick={async () => {
                      const email = (adminEmailDrafts[c.id] ?? c.companyAdminEmail ?? "").trim();
                      const password = adminPasswordDrafts[c.id] ?? "";
                      if (!email && !password) return setError("Provide email and/or new password.");
                      const res = await fetch(`/api/admin/companies/${c.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ adminEmail: email || undefined, adminPassword: password || undefined }),
                      });
                      if (res.ok) void load();
                      else {
                        const d = await res.json().catch(() => ({ error: "Update failed" }));
                        setError(d.error ?? "Update failed");
                      }
                    }}
                  >
                    Save admin
                  </Button>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </CardContent>
    </Card>
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
    <Card sx={shellSx}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          Branches
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Set branch geofence from map and control editable radius.
        </Typography>

        <Box component="form" onSubmit={createBranch} sx={{ mt: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <TextField value={name} onChange={(e) => setName(e.target.value)} label="Branch name" size="small" />
          <FormControl size="small">
            <InputLabel id="company-label">Company</InputLabel>
            <Select labelId="company-label" label="Company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <MenuItem value={c.id} key={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ gridColumn: { xs: "span 1", md: "span 2" } }}>
            <BranchLocationPicker
              latitude={latitude}
              longitude={longitude}
              radiusMeters={radiusMeters}
              onChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Selected: {latitude?.toFixed(6) ?? "-"}, {longitude?.toFixed(6) ?? "-"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ gridColumn: { xs: "span 1", md: "span 2" } }}>
            <TextField
              size="small"
              type="number"
              label="Radius (meters)"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value || 100))}
              sx={{ width: 180 }}
            />
            <Button type="submit" variant="contained">
              Add branch
            </Button>
          </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {branches.map((b) => (
            <Paper key={b.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {b.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {b.company?.name ?? "-"} - {b.latitude ?? "-"}, {b.longitude ?? "-"} - {b.radiusMeters}m
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setEditingBranchId(b.id);
                      setEditName(b.name);
                      setEditRadius(b.radiusMeters);
                      setEditLatitude(b.latitude);
                      setEditLongitude(b.longitude);
                    }}
                  >
                    Edit settings
                  </Button>
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={async () => {
                      if (!confirm("Delete this branch?")) return;
                      const res = await fetch(`/api/admin/branches/${b.id}`, { method: "DELETE" });
                      if (res.ok) void load();
                      else {
                        const d = await res.json().catch(() => ({ error: "Delete failed" }));
                        setError(d.error ?? "Delete failed");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </Stack>
              </Stack>

              {editingBranchId === b.id && (
                <Paper variant="outlined" sx={{ mt: 1.5, borderRadius: 2, p: 2 }}>
                  <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                    <TextField size="small" label="Branch name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <TextField
                      size="small"
                      type="number"
                      label="Radius (meters)"
                      value={editRadius}
                      onChange={(e) => setEditRadius(Number(e.target.value || 100))}
                    />
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <BranchLocationPicker
                      latitude={editLatitude}
                      longitude={editLongitude}
                      radiusMeters={editRadius}
                      onChange={(lat, lng) => {
                        setEditLatitude(lat);
                        setEditLongitude(lng);
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      Selected: {editLatitude?.toFixed(6) ?? "-"}, {editLongitude?.toFixed(6) ?? "-"}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button
                      variant="contained"
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
                    >
                      Save settings
                    </Button>
                    <Button variant="text" onClick={() => setEditingBranchId(null)}>
                      Cancel
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Paper>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function CompanyWorkspaceSection() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", branchId: "", employeeCode: "", notes: "", role: "OTHER" as EmployeeRole });
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
  }, [branches]);

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
    setForm({ name: "", email: "", password: "", branchId: "", employeeCode: "", notes: "", role: "OTHER" });
    void load();
  }

  return (
    <Stack spacing={3}>
      <Card sx={shellSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Branch QR Sessions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Active QR pages auto-refresh before expiry.
          </Typography>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Box sx={{ mt: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
            {branches.map((b) => (
              <Paper key={b.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {b.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Employees: {b._count?.employees ?? 0} - Radius: {b.radiusMeters}m
                </Typography>
                {qrLoadingByBranch[b.id] && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.2, display: "block" }}>
                    Generating QR...
                  </Typography>
                )}
                {qrByBranch[b.id] && (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrByBranch[b.id].dataUrl} alt={`${b.name} QR`} className="h-24 w-24 rounded-lg border border-slate-200 bg-white p-1" />
                    <Stack spacing={0.7}>
                      <Typography variant="caption" color="text.secondary">
                        Expires: {new Date(qrByBranch[b.id].expiresAt).toLocaleString()}
                      </Typography>
                      <Button variant="outlined" size="small" href={qrByBranch[b.id].publicUrl} target="_blank" rel="noreferrer">
                        Open external QR page
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </Paper>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Card sx={shellSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Add Employee
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add and assign employees to a branch with role and credentials.
          </Typography>
          <Box component="form" onSubmit={createEmployee} autoComplete="off" sx={{ mt: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" } }}>
            <TextField autoComplete="off" label="Name" size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField autoComplete="new-email" label="Email" size="small" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField autoComplete="new-password" label="Password" type="password" size="small" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <FormControl size="small">
              <InputLabel id="branch-employee-label">Branch</InputLabel>
              <Select labelId="branch-employee-label" label="Branch" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel id="role-employee-label">Role</InputLabel>
              <Select labelId="role-employee-label" label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as EmployeeRole })}>
                {EMPLOYEE_ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField autoComplete="off" label="Employee code" size="small" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
            <TextField autoComplete="off" label="Notes" size="small" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Box sx={{ gridColumn: { xs: "span 1", md: "span 3" } }}>
              <Button type="submit" variant="contained">
                Create employee
              </Button>
            </Box>
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </CardContent>
      </Card>

      <Card sx={shellSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Employee Directory
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{e.name}</TableCell>
                    <TableCell>{(e.role ?? "OTHER").replaceAll("_", " ")}</TableCell>
                    <TableCell>{e.user.email}</TableCell>
                    <TableCell>{e.branch?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Chip size="small" color={e.user.isActive ? "success" : "default"} label={e.user.isActive ? "Active" : "Disabled"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
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
    <Card sx={shellSx}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          Work Hours
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mt: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="hours-branch-label">Branch</InputLabel>
            <Select labelId="hours-branch-label" label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant={mode === "week" ? "contained" : "outlined"} onClick={() => setMode("week")}>
            Week
          </Button>
          <Button variant={mode === "month" ? "contained" : "outlined"} onClick={() => setMode("month")}>
            Month
          </Button>
          {mode === "week" ? (
            <TextField size="small" type="date" value={week} onChange={(e) => setWeek(e.target.value)} />
          ) : (
            <TextField size="small" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          )}
        </Stack>
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell align="right">Hours</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                  <TableCell align="right">{r.hours.toFixed(2)} h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
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
    <Card sx={shellSx}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          Attendance Logs
        </Typography>
        <Box sx={{ mt: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr 1fr auto" } }}>
          <TextField size="small" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <FormControl size="small">
            <InputLabel id="logs-branch-label">Branch</InputLabel>
            <Select labelId="logs-branch-label" label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <MenuItem value="">All branches</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="logs-employee-label">Employee</InputLabel>
            <Select labelId="logs-employee-label" label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <MenuItem value="">All employees</MenuItem>
              {employees.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1}>
            <Button href={`/api/admin/attendance-logs?${csvParams.toString()}`} variant="outlined" size="small">CSV</Button>
            <Button href={`/api/admin/attendance-logs?${xlsxParams.toString()}`} variant="outlined" size="small">Excel</Button>
          </Stack>
        </Box>
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
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
      </CardContent>
    </Card>
  );
}
