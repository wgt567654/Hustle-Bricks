import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";

type Role = "admin" | "member" | "sales";

type TeamMember = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  is_pending: boolean;
  certifications: string[];
  hourly_rate: number | null;
  commission_rate: number | null;
};

export default async function TeamPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let businessId: string | null = null;
  let members: TeamMember[] = [];
  let pendingMembers: TeamMember[] = [];
  const workload: Record<string, number> = {};
  const memberAvailability: Record<string, Record<number, { from: string; until: string }>> = {};
  const memberBlockedDates: Record<string, string[]> = {};
  const memberTerritories: Record<string, string[]> = {};

  if (userId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (business) {
      businessId = business.id;

      const { data } = await supabase
        .from("team_members")
        .select("id, user_id, name, email, role, is_active, is_pending, certifications, hourly_rate, commission_rate")
        .eq("business_id", business.id)
        .order("name");

      const allMembers = (data ?? []) as TeamMember[];
      const activeMembers = allMembers.filter((m) => m.is_active && !m.is_pending);
      const pendingList = allMembers.filter((m) => m.is_pending);

      const memberList = activeMembers;
      members = memberList.map((m) => ({ ...m, certifications: m.certifications ?? [] }));
      pendingMembers = pendingList.map((m) => ({ ...m, certifications: m.certifications ?? [] }));

      // Fetch workload: active jobs per member
      if (memberList.length > 0) {
        const memberIds = memberList.map((m) => m.id);
        const { data: jobData } = await supabase
          .from("jobs")
          .select("assigned_member_id")
          .in("assigned_member_id", memberIds)
          .in("status", ["scheduled", "in_progress"]);

        for (const j of jobData ?? []) {
          if (j.assigned_member_id) {
            workload[j.assigned_member_id] = (workload[j.assigned_member_id] ?? 0) + 1;
          }
        }
      }

      // Fetch employee availability and blocked dates
      const [{ data: availData }, { data: blockedData }, { data: terrData }] = await Promise.all([
        supabase.from("employee_availability").select("team_member_id, day_of_week, from_time, until_time").eq("business_id", business.id),
        supabase.from("employee_blocked_dates").select("team_member_id, blocked_date").eq("business_id", business.id),
        supabase.from("territory_assignments").select("team_member_id, zip_code").eq("business_id", business.id),
      ]);

      for (const row of terrData ?? []) {
        if (!memberTerritories[row.team_member_id]) memberTerritories[row.team_member_id] = [];
        memberTerritories[row.team_member_id].push(row.zip_code);
      }

      for (const row of availData ?? []) {
        if (!memberAvailability[row.team_member_id]) memberAvailability[row.team_member_id] = {};
        memberAvailability[row.team_member_id][row.day_of_week] = { from: row.from_time, until: row.until_time };
      }

      for (const row of blockedData ?? []) {
        if (!memberBlockedDates[row.team_member_id]) memberBlockedDates[row.team_member_id] = [];
        memberBlockedDates[row.team_member_id].push(row.blocked_date);
      }
    }
  }

  return (
    <TeamClient
      initialMembers={members}
      initialPendingMembers={pendingMembers}
      initialBusinessId={businessId}
      initialWorkload={workload}
      initialMemberAvailability={memberAvailability}
      initialMemberBlockedDates={memberBlockedDates}
      initialMemberTerritories={memberTerritories}
    />
  );
}
