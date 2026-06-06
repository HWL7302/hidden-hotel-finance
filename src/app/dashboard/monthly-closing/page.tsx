import { AccessDenied } from "@/components/AccessDenied";
import { MonthlyClosingManager } from "@/components/MonthlyClosingManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function MonthlyClosingPage() {
  const context = await getDashboardContext("monthlyClosing");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <MonthlyClosingManager
      currentRole={context.currentRole}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}
