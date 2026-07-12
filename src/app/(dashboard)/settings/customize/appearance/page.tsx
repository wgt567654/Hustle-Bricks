import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomization } from "@/lib/customization";
import AppearanceClient from "./AppearanceClient";

export default async function AppearancePage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!business) redirect("/settings");

  const customization = await getCustomization(supabase, business.id);

  return (
    <AppearanceClient businessId={business.id} initialTheme={customization.theme} />
  );
}
