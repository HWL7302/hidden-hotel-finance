import { redirect } from "next/navigation";
import { DevelopmentCleanupManager } from "@/components/DevelopmentCleanupManager";
import { createClient } from "@/lib/supabase-server";

export default async function DevelopmentCleanupPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" || !profile.store_id) {
    redirect("/dashboard");
  }

  return <DevelopmentCleanupManager storeId={profile.store_id} />;
}
