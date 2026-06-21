import { createClient } from "@/lib/supabase/server";
import TerritoriesClient from "./TerritoriesClient";

const PALETTE = [
  "#007AFF", "#FF9500", "#34C759", "#FF2D55",
  "#AF52DE", "#5AC8FA", "#FF6B35", "#00C7BE",
  "#30D158", "#BF5AF2", "#FF3A30", "#FFCC00",
];

type TerritoryJob = {
  id: string;
  status: string;
  total: number;
  job_line_items: { description: string }[];
  clients: { name: string; address: string | null } | null;
};

type Member = {
  id: string;
  name: string;
  zips: string[];
  color: string;
  jobCount: number;
};

export default async function TerritoriesPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let initialJobs: TerritoryJob[] = [];
  let initialMembers: Member[] = [];
  const initialZipToMember: Record<string, string> = {};

  if (userId) {
    const { data: bizList } = await supabase
      .from("businesses").select("id").eq("owner_id", userId).limit(1);
    const business = bizList?.[0];

    if (business) {
      const [{ data: jobs }, { data: teamMembers }, { data: territories }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, job_line_items(description), clients(name, address)")
          .eq("business_id", business.id)
          .not("status", "eq", "cancelled")
          .order("created_at", { ascending: false }),
        supabase
          .from("team_members").select("id, name")
          .eq("business_id", business.id).eq("is_active", true).eq("is_pending", false).order("name"),
        supabase
          .from("territory_assignments").select("team_member_id, zip_code")
          .eq("business_id", business.id),
      ]);

      const memberZips: Record<string, string[]> = {};
      for (const t of territories ?? []) {
        initialZipToMember[t.zip_code] = t.team_member_id;
        if (!memberZips[t.team_member_id]) memberZips[t.team_member_id] = [];
        memberZips[t.team_member_id].push(t.zip_code);
      }

      initialMembers = (teamMembers ?? []).map((m, i) => ({
        id: m.id,
        name: m.name,
        zips: (memberZips[m.id] ?? []).sort(),
        color: PALETTE[i % PALETTE.length],
        jobCount: 0,
      }));

      const jobList = (jobs ?? []) as unknown as TerritoryJob[];
      initialJobs = jobList.filter((j) => j.clients?.address);
    }
  }

  return (
    <TerritoriesClient
      initialJobs={initialJobs}
      initialMembers={initialMembers}
      initialZipToMember={initialZipToMember}
    />
  );
}
