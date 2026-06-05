import { HomeDashboard } from "@/components/HomeDashboard";
import { createClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let defaultStoreId: string | null = null;
  let storeLoadError = "";

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      storeLoadError = profileError.message;
    }

    defaultStoreId = profile?.store_id ?? null;

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
  }

  return (
    <HomeDashboard
      defaultStoreId={defaultStoreId}
      storeLoadError={storeLoadError}
    />
  );
}
