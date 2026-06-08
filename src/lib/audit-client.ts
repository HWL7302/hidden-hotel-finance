import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/permissions";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "upload"
  | "download"
  | "export"
  | "lock"
  | "unlock"
  | "generate"
  | "refresh"
  | "mark_paid"
  | "mark_deferred";

type AuditTargetType =
  | "income"
  | "expense"
  | "voucher"
  | "room"
  | "monthly_rent"
  | "investor"
  | "investment_record"
  | "dividend"
  | "report"
  | "settlement"
  | "audit_log";

const actionText: Record<AuditAction, string> = {
  create: "新增",
  update: "编辑",
  delete: "删除",
  upload: "上传",
  download: "下载",
  export: "导出",
  lock: "锁定",
  unlock: "解锁",
  generate: "生成",
  refresh: "刷新",
  mark_paid: "标记已发放",
  mark_deferred: "标记暂缓发放"
};

const targetText: Record<AuditTargetType, string> = {
  income: "收入记录",
  expense: "支出记录",
  voucher: "凭证",
  room: "房间",
  monthly_rent: "月租记录",
  investor: "投资人",
  investment_record: "投资记录",
  dividend: "分红",
  report: "报表",
  settlement: "月份",
  audit_log: "审计日志"
};

function buildOperationText({
  action,
  targetType,
  targetName,
  operationText
}: {
  action: AuditAction;
  targetType: AuditTargetType;
  targetName?: string | null;
  operationText?: string | null;
}) {
  if (operationText?.trim()) {
    return operationText.trim();
  }

  const text = `${actionText[action]}${targetText[targetType]}`;
  return targetName ? `${text}：${targetName}` : text;
}

export async function logAuditEvent({
  supabase,
  storeId,
  userRole,
  action,
  targetType,
  targetName = null,
  operationText = null,
  isTestData = true
}: {
  supabase: SupabaseClient;
  storeId: string | null;
  userRole: AppRole;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  targetName?: string | null;
  details?: Record<string, unknown> | null;
  operationText?: string | null;
  isTestData?: boolean;
}) {
  if (!storeId) {
    return;
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("audit_logs").insert({
      store_id: storeId,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      user_role: userRole,
      action,
      target_type: targetType,
      operation_text: buildOperationText({
        action,
        targetType,
        targetName,
        operationText
      }),
      is_test_data: isTestData
    });

    if (error) {
      console.warn("Audit log insert failed:", error.message);
    }
  } catch (error) {
    console.warn(
      "Audit log insert failed:",
      error instanceof Error ? error.message : error
    );
  }
}
