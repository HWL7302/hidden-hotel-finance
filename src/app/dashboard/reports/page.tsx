import { AccessDenied } from "@/components/AccessDenied";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function ReportsPage() {
  const context = await getDashboardContext("reports");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <ModulePlaceholder
      title="导出报表"
      description="预留月度财务、投资人分红和审计报表入口；Phase 1 暂不实现 Excel 或 PDF 导出。"
    />
  );
}
