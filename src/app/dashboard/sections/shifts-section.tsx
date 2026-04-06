"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { normalizeHHMM } from "@/lib/shift-time";
import { useCallback, useEffect, useState } from "react";
import type { Branch } from "../types";
import { primaryButtonClass as primaryBtn } from "../types";

type ShiftRow = {
  id: string;
  branchId: string;
  name: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  crossesMidnight: boolean;
};

type OperatingDay = {
  dayOfWeek: number;
  label: string;
  openTime: string | null;
  closeTime: string | null;
};

function toHoursMins(hhmm: string | null) {
  if (!hhmm) return "closed";
  return normalizeHHMM(hhmm) ?? hhmm;
}

export function ShiftsSection() {
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [operatingDays, setOperatingDays] = useState<OperatingDay[]>([]);
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [busy, setBusy] = useState<string | false>(false);
  const [opsBusy, setOpsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/branches")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.branches ?? []) as Branch[];
        setBranches(list);
        setBranchId((prev) => (prev || !list.length ? prev : list[0]!.id));
      });
  }, []);

  const loadShifts = useCallback(async () => {
    if (!branchId) return;
    setError(null);
    const res = await fetch(`/api/admin/shifts?branchId=${encodeURIComponent(branchId)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load shifts");
      setShifts([]);
      return;
    }
    setShifts(data.shifts ?? []);
  }, [branchId]);

  const loadOperatingHours = useCallback(async () => {
    if (!branchId) return;
    setError(null);
    const res = await fetch(`/api/admin/branch-operating-hours?branchId=${encodeURIComponent(branchId)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load branch operating hours");
      setOperatingDays([]);
      return;
    }
    setOperatingDays(data.days ?? []);
  }, [branchId]);

  useEffect(() => {
    void loadShifts();
    void loadOperatingHours();
  }, [loadOperatingHours, loadShifts]);

  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setError(null);
    setBusy("add");
    const res = await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        name: newName.trim() || null,
        startTime: newStart,
        endTime: newEnd,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed to add shift");
    await loadShifts();
    setNewName("");
  }

  async function removeShift(id: string) {
    if (!confirm("Delete this shift?")) return;
    setError(null);
    setBusy(id);
    const res = await fetch(`/api/admin/shifts/${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error ?? "Delete failed");
    }
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  async function saveOperatingHours() {
    if (!branchId) return;
    setError(null);
    setOpsBusy(true);
    const res = await fetch("/api/admin/branch-operating-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        days: operatingDays.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          openTime: d.openTime || null,
          closeTime: d.closeTime || null,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setOpsBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save branch operating hours");
      return;
    }
    setOperatingDays(data.days ?? []);
  }

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="px-4 pt-6 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">Branch shifts</CardTitle>
        <CardDescription>
          Define expected working windows in 24-hour local time (e.g. 09:00–17:00). If the end time is earlier on
          the clock than the start (e.g. 22:00–06:00), it is treated as overnight. Shifts are for planning and
          reference; check-in is not blocked outside these times. Also set branch operation times for Monday–Sunday
          (e.g. Monday 16:00–02:00) to enforce closing-time attendance rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <div className="max-w-xs space-y-2">
          <Label>Branch</Label>
          <Select value={branchId || undefined} onValueChange={setBranchId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.company?.name ? `${b.name} · ${b.company.name}` : b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Branch operation times (all 7 days)</h3>
            <p className="text-muted-foreground text-xs">
              Set opening and closing for each day. Example format: Monday {toHoursMins("16:00")} -{" "}
              {toHoursMins("02:00")}.
            </p>
          </div>
          <div className="space-y-2">
            {operatingDays.map((d) => (
              <div key={d.dayOfWeek} className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-center">
                <div className="text-sm font-medium">{d.label}</div>
                <Input
                  type="time"
                  value={d.openTime ?? ""}
                  onChange={(e) =>
                    setOperatingDays((prev) =>
                      prev.map((row) =>
                        row.dayOfWeek === d.dayOfWeek ? { ...row, openTime: e.target.value || null } : row
                      )
                    )
                  }
                />
                <Input
                  type="time"
                  value={d.closeTime ?? ""}
                  onChange={(e) =>
                    setOperatingDays((prev) =>
                      prev.map((row) =>
                        row.dayOfWeek === d.dayOfWeek ? { ...row, closeTime: e.target.value || null } : row
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setOperatingDays((prev) =>
                      prev.map((row) =>
                        row.dayOfWeek === d.dayOfWeek ? { ...row, openTime: null, closeTime: null } : row
                      )
                    )
                  }
                >
                  Closed
                </Button>
                <p className="text-muted-foreground text-xs sm:col-start-2 sm:col-end-5">
                  {d.label} {toHoursMins(d.openTime)} - {toHoursMins(d.closeTime)}
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" className={primaryBtn} disabled={opsBusy || !branchId} onClick={() => void saveOperatingHours()}>
              {opsBusy ? "Saving…" : "Save operating hours"}
            </Button>
          </div>
        </div>

        <form onSubmit={addShift} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 space-y-2 sm:max-w-[140px]">
            <Label htmlFor="shift-name">Label</Label>
            <Input id="shift-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Opening" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-start">Start</Label>
            <Input id="shift-start" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-full sm:w-auto" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-end">End</Label>
            <Input id="shift-end" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-full sm:w-auto" />
          </div>
          <Button type="submit" disabled={busy !== false || !branchId} className={primaryBtn}>
            {busy === "add" ? "Adding…" : "Add shift"}
          </Button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="w-[120px]"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!shifts.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center text-sm">
                    No shifts for this branch yet.
                  </TableCell>
                </TableRow>
              ) : (
                shifts.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name || "—"}</TableCell>
                    <TableCell className="tabular-nums">{s.startTime}</TableCell>
                    <TableCell className="tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        {s.endTime}
                        {s.crossesMidnight ? (
                          <Badge variant="secondary" className="text-xs font-normal">
                            +1 day
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy !== false}
                        onClick={() => void removeShift(s.id)}
                      >
                        {busy === s.id ? "…" : "Delete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
