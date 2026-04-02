import { auth } from "@/lib/auth";
import { DashboardClient } from "./dashboard-shell";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fdashboard");
  if (session.user.role === "EMPLOYEE") redirect("/employee");
  return <DashboardClient />;
}
