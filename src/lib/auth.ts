import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim() : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
        const adminPasswordPlain = process.env.ADMIN_PASSWORD?.trim();

        const emailLower = email.toLowerCase();

        // Backward-compatible env admin login (acts as MASTER_ADMIN)
        if (adminEmail && emailLower === adminEmail) {
          if (adminPasswordHash) {
            const ok = await bcrypt.compare(password, adminPasswordHash);
            if (!ok) return null;
          } else if (adminPasswordPlain) {
            if (password !== adminPasswordPlain) return null;
          } else {
            return null;
          }
          return {
            id: "env-master-admin",
            email,
            name: "Master Admin",
            role: "MASTER_ADMIN",
          };
        }

        const user = await prisma.user.findUnique({
          where: { email: emailLower },
          include: {
            employee: {
              select: { id: true, name: true, companyId: true, branchId: true, isActive: true },
            },
          },
        });

        if (!user || !user.isActive) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        if (user.role === "EMPLOYEE" && (!user.employee || !user.employee.isActive)) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.employee?.name ?? user.email,
          role: user.role,
          companyId: user.companyId ?? user.employee?.companyId ?? null,
          branchId: user.employee?.branchId ?? null,
          employeeId: user.employee?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role =
          (user as { role?: "MASTER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE" }).role ?? "COMPANY_ADMIN";
        token.companyId = (user as { companyId?: string | null }).companyId ?? null;
        token.branchId = (user as { branchId?: string | null }).branchId ?? null;
        token.employeeId = (user as { employeeId?: string | null }).employeeId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = token.email ?? "";
        session.user.name = token.name ?? null;
        session.user.role =
          (token.role as "MASTER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE" | undefined) ?? "COMPANY_ADMIN";
        session.user.companyId = (token.companyId as string | null) ?? null;
        session.user.branchId = (token.branchId as string | null) ?? null;
        session.user.employeeId = (token.employeeId as string | null) ?? null;
      }
      return session;
    },
  },
});
