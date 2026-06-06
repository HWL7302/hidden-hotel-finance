import { AccessDenied } from "@/components/AccessDenied";
import { DividendRecordsManager } from "@/components/DividendRecordsManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DividendsPage() {
  const context = await getDashboardContext("dividends");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <DividendRecordsManager
      currentRole={context.currentRole}
      userEmail={context.userEmail}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}
