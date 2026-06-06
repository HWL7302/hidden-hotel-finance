import { redirect } from "next/navigation";
import {
  ADMIN_EMAIL,
  canAccessPage,
  type AppRole,
  type DashboardPageKey,
  getRoleLabel,
  normalizeRole
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase-server";

type ProfileRecord = {
  store_id: string | null;
};

async function resolveDefaultStoreId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  let defaultStoreId: string | null = null;
  let storeLoadError = "";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("store_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    storeLoadError = profileError.message;
  }

  defaultStoreId = (profile as ProfileRecord | null)?.store_id ?? null;

  if (!defaultStoreId) {
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (storesError) {
      storeLoadError = storesError.message;
    }

    defaultStoreId = stores?.[0]?.id ?? null;
  }

  return { defaultStoreId, storeLoadError };
}

async function resolveCurrentRole({
  supabase,
  email
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  email: string;
}): Promise<AppRole> {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === ADMIN_EMAIL) {
    return "admin";
  }

  if (!normalizedEmail) {
    return "viewer";
  }

  const { data, error } = await supabase.rpc(
    "current_investor_permission_role"
  );

  if (error) {
    return "viewer";
  }

  return normalizeRole(typeof data === "string" ? data : null);
}

export async function getDashboardContext(page?: DashboardPageKey) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { defaultStoreId, storeLoadError } = await resolveDefaultStoreId(
    supabase,
    user.id
  );
  const currentRole = await resolveCurrentRole({
    supabase,
    email: user.email ?? ""
  });

  return {
    supabase,
    user,
    userEmail: user.email ?? "未绑定邮箱",
    defaultStoreId,
    storeLoadError,
    currentRole,
    currentRoleLabel: getRoleLabel(currentRole),
    accessDenied: page ? !canAccessPage(currentRole, page) : false
  };
}
