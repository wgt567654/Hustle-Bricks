import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomization } from "@/lib/customization";
import EmailBrandingClient from "./EmailBrandingClient";

export default async function EmailBrandingPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, logo_url")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!business) redirect("/settings");

  const customization = await getCustomization(supabase, business.id);

  return (
    <EmailBrandingClient
      businessId={business.id}
      businessName={business.name}
      logoUrl={business.logo_url}
      initialBranding={customization.emailBranding}
    />
  );
}
