"use client";

import type { TabId } from "../types";
import { CompanyWorkspaceSection } from "./company-workspace-section";
import { HoursSection } from "./hours-section";
import { LogsSection } from "./logs-section";

export function CompanyAdminScreen({ tab }: { tab: TabId }) {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {tab === "company" && <CompanyWorkspaceSection />}
      {tab === "hours" && <HoursSection />}
      {tab === "logs" && <LogsSection />}
    </div>
  );
}
