"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompanyAdminScreen } from "./sections/company-admin-screen";
import { MasterAdminScreen } from "./sections/master-admin-screen";
import type { TabId } from "./types";

export type { TabId } from "./types";

const tabBtn =
  "shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

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
        { id: "qrBranding" as TabId, label: "QR page" },
      ];
    }
    if (role === "COMPANY_ADMIN") {
      return [
        { id: "company" as TabId, label: "Workspace" },
        { id: "hours" as TabId, label: "Hours" },
        { id: "logs" as TabId, label: "Logs" },
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
    <div className="dark min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">WAQT Attendance</h1>
            <p className="text-muted-foreground truncate text-xs sm:text-sm">{roleLabel}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => signOut({ callbackUrl: "/login?callbackUrl=%2Fdashboard" })}
          >
            Sign out
          </Button>
        </div>
        <nav className="mx-auto max-w-6xl px-4 pb-3" aria-label="Dashboard sections">
          <div
            className={cn(
              "flex w-full flex-wrap gap-1 rounded-lg bg-muted/50 p-1",
              "sm:flex-nowrap sm:overflow-x-auto sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
            )}
            role="tablist"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  tabBtn,
                  tab === t.id ? "bg-amber-500 text-black shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {role === "MASTER_ADMIN" && <MasterAdminScreen tab={tab} />}
        {role === "COMPANY_ADMIN" && <CompanyAdminScreen tab={tab} />}
      </main>
    </div>
  );
}
