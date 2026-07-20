import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// User instruction (edit gate): "please go ahead and build and test all of the
// features we discussed related to quoting and scheduling."
//
// Sprint 2.1: duration-aware capacity. Slot STARTS are generated every 30
// minutes across the business day. A slot is offered only if the entire
// window [start, start + duration] fits within business hours AND enough
// workers are free for the whole window.

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!businessId || !date) {
    return NextResponse.json({ error: "Missing businessId or date" }, { status: 400 });
  }

  // Requested duration in minutes (default 60, clamped to 15..480).
  const durationRaw = parseInt(searchParams.get("duration") ?? "60", 10);
  const duration = Math.min(480, Math.max(15, Number.isFinite(durationRaw) ? durationRaw : 60));
  // service_ids is accepted for forward compatibility (e.g. per-service
  // qualification filtering) but does not change the capacity math today.

  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat

  // 1. Get crew size
  const { data: crewData } = await supabase
    .from("business_crew_settings")
    .select("crew_size")
    .eq("business_id", businessId)
    .maybeSingle();
  const crewSize = Math.max(1, (crewData as { crew_size: number } | null)?.crew_size ?? 1);

  // 2. Get scheduling settings to know which hours to include
  const { data: schedData } = await supabase
    .from("scheduling_settings")
    .select("day_hours, unavailable_days")
    .eq("business_id", businessId)
    .maybeSingle();

  const unavailableDays: number[] = (schedData as { unavailable_days: number[] } | null)?.unavailable_days ?? [0, 6];
  const dayHours: Record<string, { from: string; until: string }> =
    (schedData as { day_hours: Record<string, { from: string; until: string }> } | null)?.day_hours ?? {};

  // If the day is marked unavailable, return empty
  if (unavailableDays.includes(dayOfWeek)) {
    return NextResponse.json({});
  }

  const dayKey = String(dayOfWeek);
  const dayRange = dayHours[dayKey];
  if (!dayRange) {
    return NextResponse.json({});
  }

  const openMins = toMins(dayRange.from);
  const closeMins = toMins(dayRange.until);

  // Slot starts every 30 minutes; the whole window must fit before close.
  // A duration longer than the business day naturally yields no slots.
  const slotStarts: number[] = [];
  for (let t = openMins; t + duration <= closeMins; t += 30) {
    slotStarts.push(t);
  }
  if (slotStarts.length === 0) {
    return NextResponse.json({});
  }

  // Day window for job queries (server-local, consistent with dispatch.ts)
  const dayStart = new Date(date + "T00:00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // 3. Fetch everything needed for worker-free math in parallel
  const [
    { data: memberData },
    { data: availData },
    { data: blockedData },
    { data: bookingData },
    { data: jobData },
  ] = await Promise.all([
    // Active, non-pending employees
    supabase
      .from("team_members")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("is_pending", false),
    // Their recurring availability for this weekday
    supabase
      .from("employee_availability")
      .select("team_member_id, from_time, until_time")
      .eq("business_id", businessId)
      .eq("day_of_week", dayOfWeek),
    // One-off blocked dates (PTO etc.)
    supabase
      .from("employee_blocked_dates")
      .select("team_member_id")
      .eq("business_id", businessId)
      .eq("blocked_date", date),
    // Accepted booking requests that day (each occupies one crew)
    supabase
      .from("booking_requests")
      .select("requested_time, duration_mins")
      .eq("business_id", businessId)
      .eq("requested_date", date)
      .eq("status", "accepted"),
    // Scheduled / in-progress jobs that day (occupy their assigned workers,
    // or one crew if unassigned)
    supabase
      .from("jobs")
      .select("scheduled_at, duration_mins, assigned_member_id, job_crew(team_member_id)")
      .eq("business_id", businessId)
      .in("status", ["scheduled", "in_progress"])
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", dayStart.toISOString())
      .lt("scheduled_at", dayEnd.toISOString()),
  ]);

  const activeIds = new Set(((memberData ?? []) as { id: string }[]).map((m) => m.id));
  const blockedIds = new Set(
    ((blockedData ?? []) as { team_member_id: string }[]).map((b) => b.team_member_id)
  );

  // Availability windows in minutes, keyed by member (active, not blocked today)
  const availByMember = new Map<string, { from: number; until: number }[]>();
  for (const a of (availData ?? []) as { team_member_id: string; from_time: string; until_time: string }[]) {
    if (!activeIds.has(a.team_member_id) || blockedIds.has(a.team_member_id)) continue;
    const list = availByMember.get(a.team_member_id) ?? [];
    list.push({ from: toMins(a.from_time), until: toMins(a.until_time) });
    availByMember.set(a.team_member_id, list);
  }

  // Busy intervals from accepted bookings: [startMins, endMins]
  const bookingIntervals = ((bookingData ?? []) as { requested_time: string; duration_mins: number | null }[])
    .map((b) => {
      const start = toMins(b.requested_time);
      return { start, end: start + (b.duration_mins ?? 60) };
    });
  const bookingStartSet = new Set(bookingIntervals.map((b) => b.start));

  // Busy intervals from jobs. Assigned jobs occupy specific workers; unassigned
  // jobs occupy one generic crew — unless they start at the same minute as an
  // accepted booking (accepting a booking creates its job, so counting both
  // would double-book that crew).
  type JobRow = {
    scheduled_at: string;
    duration_mins: number | null;
    assigned_member_id: string | null;
    job_crew: { team_member_id: string }[] | null;
  };
  const assignedJobIntervals: { start: number; end: number; memberIds: string[] }[] = [];
  const genericJobIntervals: { start: number; end: number }[] = [];
  for (const j of (jobData ?? []) as JobRow[]) {
    const jobStart = new Date(j.scheduled_at);
    const start = Math.round((jobStart.getTime() - dayStart.getTime()) / 60000);
    const end = start + (j.duration_mins ?? 60);
    const memberIds = [
      ...(j.assigned_member_id ? [j.assigned_member_id] : []),
      ...((j.job_crew ?? []).map((c) => c.team_member_id)),
    ];
    if (memberIds.length > 0) {
      assignedJobIntervals.push({ start, end, memberIds });
    } else if (!bookingStartSet.has(start)) {
      genericJobIntervals.push({ start, end });
    }
  }

  const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
    aStart < bEnd && bStart < aEnd;

  // 4. Compute capacity per slot window [start, start + duration]
  const capacity: Record<string, number> = {};
  for (const start of slotStarts) {
    const end = start + duration;

    // Workers whose recurring availability covers the ENTIRE window
    const freeWorkers = new Set<string>();
    for (const [memberId, windows] of availByMember) {
      if (windows.some((w) => w.from <= start && w.until >= end)) {
        freeWorkers.add(memberId);
      }
    }

    // Remove workers tied up by an assigned job overlapping the window
    for (const job of assignedJobIntervals) {
      if (!overlaps(start, end, job.start, job.end)) continue;
      for (const id of job.memberIds) freeWorkers.delete(id);
    }

    // Crews consumed by overlapping accepted bookings + unassigned jobs
    const busyCrews =
      bookingIntervals.filter((b) => overlaps(start, end, b.start, b.end)).length +
      genericJobIntervals.filter((j) => overlaps(start, end, j.start, j.end)).length;

    const maxConcurrent = Math.floor(freeWorkers.size / crewSize);
    capacity[toHHMM(start)] = Math.max(0, maxConcurrent - busyCrews);
  }

  return NextResponse.json(capacity);
}
