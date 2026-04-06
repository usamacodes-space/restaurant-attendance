"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateHoursMinutes } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import type { AttendanceLogRow, Branch, Employee } from "../types";

const ALL = "__all__";

export function LogsSection() {
  const [rows, setRows] = useState<AttendanceLogRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [sheetsBusy, setSheetsBusy] = useState(false);
  const [sheetsMessage, setSheetsMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetch("/api/admin/branches"), fetch("/api/admin/employees")]).then(async ([b, e]) =>
      [await b.json(), await e.json()] as const
    ).then(([bData, eData]) => {
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

  useEffect(() => {
    void load();
  }, [load]);

  const csvParams = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(branchId ? { branchId } : {}),
    ...(employeeId ? { employeeId } : {}),
    format: "csv",
  });
  const xlsxParams = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(branchId ? { branchId } : {}),
    ...(employeeId ? { employeeId } : {}),
    format: "xlsx",
  });

  async function pushToGoogleSheets() {
    setSheetsMessage(null);
    setSheetsBusy(true);
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (branchId) p.set("branchId", branchId);
    if (employeeId) p.set("employeeId", employeeId);
    const res = await fetch(`/api/admin/attendance-logs/google-sheets?${p.toString()}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSheetsBusy(false);
    if (!res.ok) {
      setSheetsMessage(data.error ?? `Sync failed (${res.status})`);
      return;
    }
    setSheetsMessage(`Synced ${data.rowCount ?? 0} row(s) to tab “${data.tabName ?? "Attendance"}”.`);
  }

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="px-4 pt-6 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">Attendance logs</CardTitle>
        <CardDescription>
          Deduction and overtime are set at checkout from each employee&apos;s scheduled shift (Workspace → employee
          shift times, UTC clock). If check-in is within the first 15 minutes after branch opening, counted hours start
          at opening time. If a shift misses branch closing checkout, checkout remains blank and no payable hours are
          counted. Google Sheets uses the same columns as CSV; configure the spreadsheet under Workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
          <div className="space-y-2">
            <Label htmlFor="log-from">From</Label>
            <Input id="log-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-to">To</Label>
            <Input id="log-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Select value={branchId || ALL} onValueChange={(v) => setBranchId(v === ALL ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={employeeId || ALL} onValueChange={(v) => setEmployeeId(v === ALL ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2 xl:flex-row">
            <Button variant="outline" size="sm" className="w-full xl:flex-1" asChild>
              <a href={`/api/admin/attendance-logs?${csvParams.toString()}`}>CSV</a>
            </Button>
            <Button variant="outline" size="sm" className="w-full xl:flex-1" asChild>
              <a href={`/api/admin/attendance-logs?${xlsxParams.toString()}`}>Excel</a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full xl:flex-1"
              disabled={sheetsBusy}
              onClick={() => void pushToGoogleSheets()}
            >
              {sheetsBusy ? "Sheets…" : "Google Sheets"}
            </Button>
          </div>
        </div>

        {sheetsMessage && (
          <p
            className={`text-sm ${sheetsMessage.startsWith("Synced") ? "text-muted-foreground" : "text-destructive"}`}
          >
            {sheetsMessage}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[52px]">In</TableHead>
                <TableHead className="min-w-[52px]">Out</TableHead>
                <TableHead className="min-w-[120px]">Employee</TableHead>
                <TableHead className="min-w-[100px]">Branch</TableHead>
                <TableHead className="min-w-[140px]">Check-in</TableHead>
                <TableHead className="min-w-[140px]">Check-out</TableHead>
                <TableHead className="min-w-[72px] text-right">Gross h</TableHead>
                <TableHead className="min-w-[88px] text-right">Deduct</TableHead>
                <TableHead className="min-w-[72px] text-right">Regular h</TableHead>
                <TableHead className="min-w-[88px] text-right">OT</TableHead>
                <TableHead className="min-w-[72px] text-right">Total</TableHead>
                <TableHead className="min-w-[160px]">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const locOk = r.locationStatus === "Matched";
                const locBad = r.locationStatus === "Outside branch radius";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Avatar className="size-9">
                        {r.checkInSelfieUrl ? <AvatarImage src={r.checkInSelfieUrl} alt="" /> : null}
                        <AvatarFallback className="text-xs">—</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      {r.checkOutSelfieUrl ? (
                        <Avatar className="size-9">
                          <AvatarImage src={r.checkOutSelfieUrl} alt="" />
                          <AvatarFallback className="text-xs">—</AvatarFallback>
                        </Avatar>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{r.employeeName}</TableCell>
                    <TableCell className="text-sm">{r.branch}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                      {r.checkInAt ? formatDateHoursMinutes(r.checkInAt) : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                      {r.checkOutAt ? formatDateHoursMinutes(r.checkOutAt) : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                      {typeof r.hours === "number" ? `${r.hours.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                      {typeof r.hours === "number" ? `${Number(r.deductionHours).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                      {typeof r.netHours === "number" ? `${r.netHours.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                      {typeof r.hours === "number" ? `${Number(r.overtimeHours).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                      {typeof r.totalHours === "number" ? `${r.totalHours.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[200px] flex-col gap-1">
                        <Badge
                          variant={locOk ? "default" : locBad ? "destructive" : "secondary"}
                          className="w-fit text-xs"
                        >
                          {r.locationStatus ?? "Unknown"}
                        </Badge>
                        <span className="text-muted-foreground text-xs break-all">
                          {r.checkInLatitude || "-"}, {r.checkInLongitude || "-"}
                        </span>
                        {typeof r.distanceMeters === "number" && typeof r.branchRadiusMeters === "number" && (
                          <span className="text-muted-foreground text-xs">
                            {r.distanceMeters}m / {r.branchRadiusMeters}m
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
