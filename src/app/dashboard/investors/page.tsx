import { AccessDenied } from "@/components/AccessDenied";
import { InvestorManager } from "@/components/InvestorManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function InvestorsPage() {
  const context = await getDashboardContext("investors");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <InvestorManager
      currentRole={context.currentRole}
      userEmail={context.userEmail}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}
