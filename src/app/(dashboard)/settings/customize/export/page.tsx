import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExportClient from "./ExportClient";

export default async function ExportPage() {
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

  return <ExportClient businessId={business.id} businessName={business.name} />;
}
