"use client";

import type { TabId } from "../types";
import { BranchesSection } from "./branches-section";
import { CompaniesSection } from "./companies-section";
import { QrBrandingSection } from "./qr-branding-section";

export function MasterAdminScreen({ tab }: { tab: TabId }) {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {tab === "companies" && <CompaniesSection />}
      {tab === "branches" && <BranchesSection />}
      {tab === "qrBranding" && <QrBrandingSection />}
    </div>
  );
}
