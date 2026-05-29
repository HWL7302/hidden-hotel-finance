import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase-server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <DashboardShell userEmail={user.email ?? "未绑定邮箱"}>{children}</DashboardShell>;
}
