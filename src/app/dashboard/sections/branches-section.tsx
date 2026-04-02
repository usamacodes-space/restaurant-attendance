"use client";

import dynamic from "next/dynamic";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallback, useEffect, useState } from "react";
import type { Branch, Company } from "../types";
import { primaryButtonClass } from "../types";

const BranchLocationPicker = dynamic(
  () => import("../branch-location-picker").then((m) => m.BranchLocationPicker),
  { ssr: false }
);

export function BranchesSection() {
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
      body: JSON.stringify({ name, companyId, radiusMeters, latitude, longitude }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed");
    setName("");
    setLatitude(null);
    setLongitude(null);
    void load();
  }

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="px-4 pt-6 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">Branches</CardTitle>
        <CardDescription>Set branch geofence on the map and radius.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
        <form onSubmit={createBranch} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="br-name">Branch name</Label>
              <Input id="br-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={companyId || undefined} onValueChange={setCompanyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <BranchLocationPicker
            latitude={latitude}
            longitude={longitude}
            radiusMeters={radiusMeters}
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
          <p className="text-muted-foreground text-xs">
            Selected: {latitude?.toFixed(6) ?? "-"}, {longitude?.toFixed(6) ?? "-"}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:w-40">
              <Label htmlFor="radius">Radius (m)</Label>
              <Input
                id="radius"
                type="number"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value || 100))}
              />
            </div>
            <Button type="submit" className={primaryButtonClass}>
              Add branch
            </Button>
          </div>
        </form>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ul className="space-y-3">
          {branches.map((b) => (
            <li key={b.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-muted-foreground text-sm break-words">
                    {b.company?.name ?? "-"} · {b.latitude ?? "-"}, {b.longitude ?? "-"} · {b.radiusMeters}m
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingBranchId(b.id);
                      setEditName(b.name);
                      setEditRadius(b.radiusMeters);
                      setEditLatitude(b.latitude);
                      setEditLongitude(b.longitude);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
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
                </div>
              </div>

              {editingBranchId === b.id && (
                <div className="mt-4 space-y-4 rounded-lg border border-dashed border-border p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Branch name</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Radius (m)</Label>
                      <Input
                        type="number"
                        value={editRadius}
                        onChange={(e) => setEditRadius(Number(e.target.value || 100))}
                      />
                    </div>
                  </div>
                  <BranchLocationPicker
                    latitude={editLatitude}
                    longitude={editLongitude}
                    radiusMeters={editRadius}
                    onChange={(lat, lng) => {
                      setEditLatitude(lat);
                      setEditLongitude(lng);
                    }}
                  />
                  <p className="text-muted-foreground text-xs">
                    Selected: {editLatitude?.toFixed(6) ?? "-"}, {editLongitude?.toFixed(6) ?? "-"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className={primaryButtonClass}
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
                    <Button variant="ghost" onClick={() => setEditingBranchId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
