import { createClient } from "@/lib/supabase/server";
import IntelClient, { type IntelRow } from "./IntelClient";

export default async function IntelPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let rows: IntelRow[] = [];

  if (userId) {
    const { data: bizList } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .limit(1);
    const business = bizList?.[0];

    if (business) {
      const { data } = await supabase
        .from("competitor_intel")
        .select("id, competitor_name, observation_type, price_amount, notes, created_at, jobs(clients(name, address)), team_members(name)")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });

      rows = (data ?? []) as unknown as IntelRow[];
    }
  }

  return <IntelClient initialRows={rows} />;
}
