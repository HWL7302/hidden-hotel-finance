import { AccessDenied } from "@/components/AccessDenied";
import { HomeDashboard } from "@/components/HomeDashboard";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DashboardPage() {
  const context = await getDashboardContext("home");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <HomeDashboard
      currentRole={context.currentRole}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}
