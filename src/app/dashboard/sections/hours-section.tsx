"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCallback, useEffect, useState } from "react";
import type { Branch } from "../types";
import { primaryButtonClass as primaryBtn } from "../types";

const ALL_BRANCHES = "all";

export function HoursSection() {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [week, setWeek] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  /** `all` = every employee in the company; otherwise a branch id (employees + hours at that branch only). */
  const [branchId, setBranchId] = useState(ALL_BRANCHES);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<
    {
      employeeId: string;
      name: string;
      regularHours: number;
      overtimeHours: number;
      totalHours: number;
      branchName?: string;
    }[]
  >([]);

  useEffect(() => {
    void fetch("/api/admin/branches")
      .then((r) => r.json())
      .then((d) => {
        setBranches(d.branches ?? []);
      });
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ mode });
    if (mode === "week") params.set("week", week);
    else params.set("month", month);
    params.set("branchId", branchId);
    const res = await fetch(`/api/admin/hours?${params.toString()}`);
    const data = await res.json();
    if (res.ok) setRows(data.rows ?? []);
  }, [mode, week, month, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportParams = new URLSearchParams({ mode, branchId, ...(mode === "week" ? { week } : { month }) });
  const csvExport = new URLSearchParams(exportParams);
  csvExport.set("format", "csv");
  const xlsxExport = new URLSearchParams(exportParams);
  xlsxExport.set("format", "xlsx");

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="px-4 pt-6 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">Work hours</CardTitle>
        <CardDescription>
          Per employee totals for the selected period: regular hours (after deduction), overtime hours, and total
          payable hours. Uses opening-time grace-adjusted check-in for counting and the same overlap rules across
          week/month boundaries. Choose all branches or one branch. Export matches the filters below (CSV or Excel).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[220px] flex-1 space-y-2 sm:max-w-sm">
            <Label>Scope</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Branch or company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BRANCHES}>All branches (company)</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.company?.name ? `${b.name} · ${b.company.name}` : b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === "week" ? "default" : "outline"}
              size="sm"
              className={mode === "week" ? primaryBtn : ""}
              onClick={() => setMode("week")}
            >
              Week
            </Button>
            <Button
              type="button"
              variant={mode === "month" ? "default" : "outline"}
              size="sm"
              className={mode === "month" ? primaryBtn : ""}
              onClick={() => setMode("month")}
            >
              Month
            </Button>
          </div>
          {mode === "week" ? (
            <div className="space-y-2">
              <Label htmlFor="week-pick">Week</Label>
              <Input id="week-pick" type="date" value={week} onChange={(e) => setWeek(e.target.value)} className="w-full sm:w-auto" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="month-pick">Month</Label>
              <Input id="month-pick" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full sm:w-auto" />
            </div>
          )}
          <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
              <a href={`/api/admin/hours?${csvExport.toString()}`}>Export CSV</a>
            </Button>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
              <a href={`/api/admin/hours?${xlsxExport.toString()}`}>Export Excel</a>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                {branchId === ALL_BRANCHES ? <TableHead>Home branch</TableHead> : null}
                <TableHead className="text-right">Regular h</TableHead>
                <TableHead className="text-right">OT h</TableHead>
                <TableHead className="text-right">Total h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  {branchId === ALL_BRANCHES ? (
                    <TableCell className="text-muted-foreground">{r.branchName ?? "—"}</TableCell>
                  ) : null}
                  <TableCell className="text-right tabular-nums">{r.regularHours.toFixed(2)} h</TableCell>
                  <TableCell className="text-right tabular-nums">{r.overtimeHours.toFixed(2)} h</TableCell>
                  <TableCell className="text-right tabular-nums">{r.totalHours.toFixed(2)} h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
