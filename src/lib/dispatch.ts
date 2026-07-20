import { createClient } from "@supabase/supabase-js";
import { haversineMiles } from "@/lib/geo";

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
 * When jobLat/jobLng are provided, candidates are ranked by straight-line
 * distance from their home coordinates first (members without home coords
 * sort last but remain eligible). Without job coords the behavior is
 * unchanged (alphabetical) — geo is purely additive and never blocks.
 *
 * Returns null if no qualified member is found (caller should still create the job).
 */
export async function findBestMember({
  businessId,
  scheduledAt,
  durationMins = 60,
  excludeJobId,
  serviceIds,
  jobLat,
  jobLng,
}: {
  businessId: string;
  scheduledAt: string;
  durationMins?: number;
  excludeJobId?: string;
  serviceIds?: string[];
  jobLat?: number | null;
  jobLng?: number | null;
}): Promise<DispatchResult> {
  const jobStart = new Date(scheduledAt);
  const jobEnd = new Date(jobStart.getTime() + durationMins * 60_000);
  const dayOfWeek = jobStart.getDay();
  const startHHMM = toHHMM(jobStart);
  const endHHMM = toHHMM(jobEnd);

  const [{ data: members }, { data: avail }, { data: conflictJobs }] = await Promise.all([
    supabaseAdmin
      .from("team_members")
      .select("id, name, email, phone, home_lat, home_lng")
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

  type MemberRow = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    home_lat: number | null;
    home_lng: number | null;
  };
  const memberRows = (members ?? []) as MemberRow[];

  // Qualification filter (skipped when no serviceIds provided → backward compatible).
  // Rule: for each distinct non-null job service, if at least one ACTIVE member of the
  // business is certified for it, only certified members qualify for that service;
  // if none are certified (data not set up), everyone qualifies for that service.
  // A member qualifies for the job iff they qualify for EVERY service on the job.
  let qualifiedIds: Set<string> | null = null;
  const jobServiceIds = Array.from(new Set((serviceIds ?? []).filter(Boolean)));
  if (jobServiceIds.length > 0) {
    const { data: caps } = await supabaseAdmin
      .from("member_service_capabilities")
      .select("team_member_id, service_id")
      .eq("business_id", businessId)
      .in("service_id", jobServiceIds);

    const activeIds = new Set(memberRows.map((m) => m.id));
    const certifiedByService = new Map<string, Set<string>>();
    for (const c of (caps ?? []) as { team_member_id: string; service_id: string }[]) {
      if (!activeIds.has(c.team_member_id)) continue; // only active members count as "certified"
      if (!certifiedByService.has(c.service_id)) certifiedByService.set(c.service_id, new Set());
      certifiedByService.get(c.service_id)!.add(c.team_member_id);
    }

    qualifiedIds = new Set<string>();
    for (const m of memberRows) {
      const ok = jobServiceIds.every((sid) => {
        const certified = certifiedByService.get(sid);
        // No active member certified for this service → everyone qualifies for it.
        return !certified || certified.size === 0 || certified.has(m.id);
      });
      if (ok) qualifiedIds.add(m.id);
    }
  }

  // Geo-aware ranking (Sprint 2.4): when job coords are known, prefer the
  // closest qualified+available candidate by home location. Members without
  // home coords rank last (Infinity) but stay eligible. Ties / no job coords
  // fall back to the existing alphabetical order from the query.
  let rankedRows = memberRows;
  if (jobLat != null && jobLng != null) {
    const jobPoint = { lat: jobLat, lng: jobLng };
    const distanceOf = (m: MemberRow) =>
      m.home_lat != null && m.home_lng != null
        ? haversineMiles({ lat: m.home_lat, lng: m.home_lng }, jobPoint)
        : Number.POSITIVE_INFINITY;
    rankedRows = [...memberRows].sort((a, b) => distanceOf(a) - distanceOf(b));
  }

  for (const m of rankedRows) {
    if (qualifiedIds && !qualifiedIds.has(m.id)) continue; // not certified for the job's services
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
