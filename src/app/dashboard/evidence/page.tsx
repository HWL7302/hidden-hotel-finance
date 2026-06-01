import { EvidenceManager } from "@/components/EvidenceManager";
import { createClient } from "@/lib/supabase-server";

export default async function EvidencePage() {
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
    <EvidenceManager
      currentRole={currentRole}
      defaultStoreId={defaultStoreId}
      storeLoadError={storeLoadError}
    />
  );
}
