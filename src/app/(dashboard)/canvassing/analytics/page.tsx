import { createClient } from "@/lib/supabase/server";
import CanvassingAnalyticsClient, { type Property } from "./CanvassingAnalyticsClient";

export default async function CanvassingAnalyticsPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let properties: Property[] = [];
  let commissionRate = 5;

  if (userId) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, commission_rate")
      .eq("owner_id", userId)
      .maybeSingle();

    if (biz) {
      commissionRate = Number(biz.commission_rate) || 5;

      const { data: props } = await supabase
        .from("canvassing_properties")
        .select("id, status, visited_by, created_at, job_id, team_members(id, name), jobs(total, status)")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: false });

      properties = (props ?? []).map((p) => ({
        ...p,
        team_members: Array.isArray(p.team_members) ? p.team_members[0] ?? null : p.team_members,
        jobs: Array.isArray(p.jobs) ? p.jobs[0] ?? null : p.jobs,
      })) as Property[];
    }
  }

  return (
    <CanvassingAnalyticsClient
      initialProperties={properties}
      initialCommissionRate={commissionRate}
    />
  );
}
