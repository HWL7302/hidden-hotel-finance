import { AccessDenied } from "@/components/AccessDenied";
import { AuditLogManager } from "@/components/AuditLogManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function AuditLogsPage() {
  const context = await getDashboardContext("auditLogs");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <AuditLogManager
      currentRole={context.currentRole}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}
