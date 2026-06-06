import { AccessDenied } from "@/components/AccessDenied";
import { EvidenceManager } from "@/components/EvidenceManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function EvidencePage() {
  const context = await getDashboardContext("evidence");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <EvidenceManager
      currentRole={context.currentRole}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}
