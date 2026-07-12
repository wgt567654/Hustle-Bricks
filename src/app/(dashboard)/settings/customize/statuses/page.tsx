import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStatuses } from "@/lib/statuses";
import StatusesClient from "./StatusesClient";

export default async function StatusesPage() {
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

  const statuses = await getStatuses(supabase, business.id);

  return <StatusesClient businessId={business.id} initialStatuses={statuses} />;
}
