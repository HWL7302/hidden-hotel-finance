import { DashboardShell } from "@/components/DashboardShell";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { userEmail, currentRole } = await getDashboardContext();

  return (
    <DashboardShell
      userEmail={userEmail}
      currentRole={currentRole}
    >
      {children}
    </DashboardShell>
  );
}
