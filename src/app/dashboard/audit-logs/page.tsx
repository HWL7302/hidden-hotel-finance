import { AccessDenied } from "@/components/AccessDenied";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function AuditLogsPage() {
  const context = await getDashboardContext("auditLogs");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <ModulePlaceholder
      title="审计日志"
      description="锁定月份的修改必须写入审计日志，记录操作者、动作、目标表和变更内容。"
    />
  );
}
