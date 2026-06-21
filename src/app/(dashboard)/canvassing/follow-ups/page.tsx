import { createClient } from "@/lib/supabase/server";
import FollowUpsClient, { type FollowUp } from "./FollowUpsClient";

export default async function FollowUpsPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let items: FollowUp[] = [];

  if (userId) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (biz) {
      const { data } = await supabase
        .from("canvassing_properties")
        .select("id, address, lat, lng, status, notes, follow_up_date, follow_up_notes, last_visited_at, team_members(name)")
        .eq("business_id", biz.id)
        .eq("follow_up_needed", true)
        .order("follow_up_date", { ascending: true, nullsFirst: false });

      items = (data ?? []).map((p) => ({
        ...p,
        lat: typeof p.lat === "string" ? parseFloat(p.lat) : p.lat,
        lng: typeof p.lng === "string" ? parseFloat(p.lng) : p.lng,
        team_members: Array.isArray(p.team_members) ? p.team_members[0] ?? null : p.team_members,
      })) as FollowUp[];
    }
  }

  return <FollowUpsClient initialItems={items} />;
}
