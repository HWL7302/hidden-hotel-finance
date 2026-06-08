import { AccessDenied } from "@/components/AccessDenied";
import { ReportExportManager } from "@/components/ReportExportManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function ReportsPage() {
  const context = await getDashboardContext("reports");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <ReportExportManager
      currentRole={context.currentRole}
      userEmail={context.userEmail}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}
