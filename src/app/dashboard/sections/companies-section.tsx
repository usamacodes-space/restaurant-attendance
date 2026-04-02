"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useState } from "react";
import type { Company } from "../types";
import { primaryButtonClass } from "../types";

export function CompaniesSection() {
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
      setCompanyNames(Object.fromEntries((data.companies as Company[]).map((c) => [c.id, c.name])));
      setAdminEmailDrafts(
        Object.fromEntries((data.companies as Company[]).map((c) => [c.id, c.companyAdminEmail ?? ""]))
      );
      setAdminPasswordDrafts({});
    } else setError(data.error ?? "Failed to load companies");
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
    <Card className="border-border shadow-md">
      <CardHeader className="space-y-1 px-4 pt-6 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">Companies</CardTitle>
        <CardDescription>Create companies and manage company admin credentials.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
        <form
          onSubmit={createCompany}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        >
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="new-co-name">Company name</Label>
            <Input id="new-co-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="new-co-email">Admin email</Label>
            <Input id="new-co-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="new-co-pass">Admin password</Label>
            <Input id="new-co-pass" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
          </div>
          <Button type="submit" className={primaryButtonClass}>
            Add company
          </Button>
        </form>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ul className="space-y-3">
          {companies.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-card/50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2 sm:max-w-xs">
                    <Label htmlFor={`co-${c.id}`}>Company</Label>
                    <Input
                      id={`co-${c.id}`}
                      value={companyNames[c.id] ?? c.name}
                      onChange={(e) => setCompanyNames((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
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
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Branches: {c._count?.branches ?? 0}</Badge>
                  <Badge variant="secondary">Employees: {c._count?.employees ?? 0}</Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
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
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-3 md:items-end">
                <div className="space-y-2">
                  <Label htmlFor={`adm-email-${c.id}`}>Company admin email</Label>
                  <Input
                    id={`adm-email-${c.id}`}
                    value={adminEmailDrafts[c.id] ?? c.companyAdminEmail ?? ""}
                    onChange={(e) => setAdminEmailDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`adm-pass-${c.id}`}>New password (optional)</Label>
                  <Input
                    id={`adm-pass-${c.id}`}
                    type="password"
                    value={adminPasswordDrafts[c.id] ?? ""}
                    onChange={(e) => setAdminPasswordDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                </div>
                <Button
                  className={primaryButtonClass}
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
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
