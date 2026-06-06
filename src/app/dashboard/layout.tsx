import { DashboardShell } from "@/components/DashboardShell";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { userEmail, currentRole, currentRoleLabel } =
    await getDashboardContext();

  return (
    <DashboardShell
      userEmail={userEmail}
      currentRole={currentRole}
      currentRoleLabel={currentRoleLabel}
    >
      {children}
    </DashboardShell>
  );
}
