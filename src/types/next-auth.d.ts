import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "MASTER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE";
      companyId: string | null;
      branchId: string | null;
      employeeId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "MASTER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE";
    companyId?: string | null;
    branchId?: string | null;
    employeeId?: string | null;
  }
}
