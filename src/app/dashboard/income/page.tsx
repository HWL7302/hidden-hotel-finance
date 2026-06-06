import { AccessDenied } from "@/components/AccessDenied";
import { IncomeManager } from "@/components/IncomeManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function IncomePage() {
  const context = await getDashboardContext("income");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <IncomeManager
      currentUserId={context.user.id}
      currentRole={context.currentRole}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}
