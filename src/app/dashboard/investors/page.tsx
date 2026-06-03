import { InvestorManager } from "@/components/InvestorManager";
import { createClient } from "@/lib/supabase-server";

export default async function InvestorsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let defaultStoreId: string | null = null;
  let currentRole = "";
  let storeLoadError = "";

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("store_id,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      storeLoadError = profileError.message;
    }

    defaultStoreId = profile?.store_id ?? null;
    currentRole = profile?.role ?? "";
  }

  return (
    <InvestorManager
      currentRole={currentRole}
      defaultStoreId={defaultStoreId}
      storeLoadError={storeLoadError}
    />
  );
}
