import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomFields } from "@/lib/custom-fields";
import FieldsClient from "./FieldsClient";

export default async function FieldsPage() {
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

  const fields = await getCustomFields(supabase, business.id);

  return <FieldsClient businessId={business.id} initialFields={fields} />;
}
