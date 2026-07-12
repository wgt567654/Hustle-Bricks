import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TemplatesClient from "./TemplatesClient";

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!business) redirect("/settings");

  // Existing overrides (service_type='*' rows only — the automated set)
  let overrides: Record<string, string> = {};
  try {
    const { data } = await supabase
      .from("message_templates")
      .select("message_type, body")
      .eq("business_id", business.id)
      .eq("service_type", "*");
    if (data) {
      overrides = Object.fromEntries(data.map((r) => [r.message_type, r.body]));
    }
  } catch {
    // table/columns not migrated yet — defaults only
  }

  return (
    <TemplatesClient
      businessId={business.id}
      businessName={business.name}
      initialOverrides={overrides}
    />
  );
}
