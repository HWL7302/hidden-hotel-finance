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

type InvestorRoleRecord = {
  permission_role: string | null;
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
  email,
  defaultStoreId
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  email: string;
  defaultStoreId: string | null;
}): Promise<AppRole> {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === ADMIN_EMAIL) {
    return "admin";
  }

  if (!normalizedEmail) {
    return "viewer";
  }

  let query = supabase
    .from("investors")
    .select("permission_role")
    .or(`email.ilike.${normalizedEmail},contact.ilike.${normalizedEmail}`)
    .limit(1);

  if (defaultStoreId) {
    query = query.eq("store_id", defaultStoreId);
  }

  const { data, error } = await query;

  if (error) {
    return "viewer";
  }

  return normalizeRole((data?.[0] as InvestorRoleRecord | undefined)?.permission_role);
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
    email: user.email ?? "",
    defaultStoreId
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
