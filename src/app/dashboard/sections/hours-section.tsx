"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCallback, useEffect, useState } from "react";
import type { Branch } from "../types";
import { primaryButtonClass as amberBtn } from "../types";

export function HoursSection() {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [week, setWeek] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<{ employeeId: string; name: string; hours: number }[]>([]);

  useEffect(() => {
    void fetch("/api/admin/branches")
      .then((r) => r.json())
      .then((d) => {
        setBranches(d.branches ?? []);
        if ((d.branches ?? []).length) setBranchId(d.branches[0].id);
      });
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ mode });
    if (mode === "week") params.set("week", week);
    else params.set("month", month);
    if (branchId) params.set("branchId", branchId);
    const res = await fetch(`/api/admin/hours?${params.toString()}`);
    const data = await res.json();
    if (res.ok) setRows(data.rows ?? []);
  }, [mode, week, month, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="px-4 pt-6 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">Work hours</CardTitle>
        <CardDescription>Per employee totals for the selected period.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1 space-y-2 sm:max-w-xs">
            <Label>Branch</Label>
            <Select value={branchId || undefined} onValueChange={setBranchId}>
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === "week" ? "default" : "outline"}
              size="sm"
              className={mode === "week" ? amberBtn : ""}
              onClick={() => setMode("week")}
            >
              Week
            </Button>
            <Button
              type="button"
              variant={mode === "month" ? "default" : "outline"}
              size="sm"
              className={mode === "month" ? amberBtn : ""}
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
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.hours.toFixed(2)} h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
