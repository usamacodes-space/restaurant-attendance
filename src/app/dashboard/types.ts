export type TabId = "companies" | "branches" | "qrBranding" | "company" | "hours" | "shifts" | "logs";

export type EmployeeRole =
  | "DRIVER"
  | "DELIVERY_DRIVER"
  | "COFFEE_MAKER"
  | "CASHIER"
  | "WAITER"
  | "CHEF"
  | "CLEANER"
  | "OTHER";

export type Company = {
  id: string;
  name: string;
  qrCompanyLogoUrl?: string | null;
  attendanceGoogleSpreadsheetId?: string | null;
  attendanceGoogleSheetTabName?: string | null;
  _count?: { branches: number; employees: number };
  companyAdminEmail?: string | null;
};

export type Branch = {
  id: string;
  name: string;
  companyId: string;
  company?: { id: string; name: string };
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  _count?: { employees: number };
};

export type Employee = {
  id: string;
  name: string;
  role?: EmployeeRole;
  employeeCode: string | null;
  notes: string | null;
  /** UTC clock HH:MM; used at checkout for deduction (early) / OT (late). */
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  user: { email: string; isActive: boolean };
  branch?: { id: string; name: string };
};

export type AttendanceLogRow = {
  id: string;
  employeeName: string;
  checkInSelfieUrl?: string;
  checkOutSelfieUrl?: string;
  branch: string;
  checkInAt: string;
  checkOutAt: string;
  /** Shift length in hours (null if not checked out yet). */
  hours: number | null;
  /** Hours before scheduled shift start (set at checkout from employee shift). */
  deductionHours: number;
  /** Gross minus deduction (null if open shift). */
  netHours: number | null;
  /** Hours after scheduled shift end (set at checkout from employee shift). */
  overtimeHours: number;
  /** Net + overtime when checked out (null if open shift). */
  totalHours: number | null;
  checkInLatitude: number | "";
  checkInLongitude: number | "";
  locationStatus?: string;
  distanceMeters?: number | "";
  branchRadiusMeters?: number;
};

export const EMPLOYEE_ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "DRIVER", label: "Driver" },
  { value: "DELIVERY_DRIVER", label: "Delivery Driver" },
  { value: "COFFEE_MAKER", label: "Coffee Maker" },
  { value: "CASHIER", label: "Cashier" },
  { value: "WAITER", label: "Waiter" },
  { value: "CHEF", label: "Chef" },
  { value: "CLEANER", label: "Cleaner" },
  { value: "OTHER", label: "Other" },
];

export { primaryButtonClass } from "@/lib/constants-ui";
