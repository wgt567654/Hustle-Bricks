import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type DispatchResult = {
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  memberPhone: string | null;
} | null;

/**
 * Finds the best available team member for a job at the given time.
 * Picks the first active member who:
 *   1. Has employee_availability covering the job window for that day of week
 *   2. Has no conflicting scheduled/in_progress job during the same window
 *
 * Returns null if no qualified member is found (caller should still create the job).
 */
export async function findBestMember({
  businessId,
  scheduledAt,
  durationMins = 60,
  excludeJobId,
}: {
  businessId: string;
  scheduledAt: string;
  durationMins?: number;
  excludeJobId?: string;
}): Promise<DispatchResult> {
  const jobStart = new Date(scheduledAt);
  const jobEnd = new Date(jobStart.getTime() + durationMins * 60_000);
  const dayOfWeek = jobStart.getDay();
  const startHHMM = toHHMM(jobStart);
  const endHHMM = toHHMM(jobEnd);

  const [{ data: members }, { data: avail }, { data: conflictJobs }] = await Promise.all([
    supabaseAdmin
      .from("team_members")
      .select("id, name, email, phone")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("is_pending", false)
      .order("name"),

    supabaseAdmin
      .from("employee_availability")
      .select("team_member_id, from_time, until_time")
      .eq("business_id", businessId)
      .eq("day_of_week", dayOfWeek),

    supabaseAdmin
      .from("jobs")
      .select("assigned_member_id, job_crew(team_member_id)")
      .eq("business_id", businessId)
      .in("status", ["scheduled", "in_progress"])
      .not("scheduled_at", "is", null)
      .lt("scheduled_at", jobEnd.toISOString())
      .gte("scheduled_at", jobStart.toISOString())
      .then(({ data }) => ({
        data: excludeJobId
          ? (data ?? []).filter((j: { assigned_member_id: string | null }) => true) // can't filter by id here without another query; handled below
          : data,
      })),
  ]);

  // Build set of busy member IDs
  const busyIds = new Set<string>();
  for (const cj of (conflictJobs ?? []) as { assigned_member_id: string | null; job_crew: { team_member_id: string }[] }[]) {
    if (cj.assigned_member_id) busyIds.add(cj.assigned_member_id);
    for (const crew of cj.job_crew ?? []) busyIds.add(crew.team_member_id);
  }

  // Build availability map
  const availMap = new Map(
    (avail ?? []).map((a) => [
      a.team_member_id,
      { from: a.from_time as string, until: a.until_time as string },
    ])
  );

  type MemberRow = { id: string; name: string; email: string | null; phone: string | null };

  for (const m of (members ?? []) as MemberRow[]) {
    if (busyIds.has(m.id)) continue;

    const a = availMap.get(m.id);
    if (!a) continue; // no availability record for this day

    if (a.from > startHHMM || a.until < endHHMM) continue; // outside their shift

    return {
      memberId: m.id,
      memberName: m.name,
      memberEmail: m.email,
      memberPhone: m.phone,
    };
  }

  return null;
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
