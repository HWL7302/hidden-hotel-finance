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
  | "settlement";

export async function logAuditEvent({
  supabase,
  storeId,
  userRole,
  action,
  targetType,
  targetId = null,
  targetName = null,
  details = null,
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
      target_id: targetId,
      target_name: targetName,
      details,
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
