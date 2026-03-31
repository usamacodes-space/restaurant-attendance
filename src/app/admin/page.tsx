import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminEntryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fdashboard");
  if (session.user.role === "EMPLOYEE") redirect("/employee");
  redirect("/dashboard");
}

