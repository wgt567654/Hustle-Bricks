import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import CalendarClient from "./CalendarClient";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  clients: { name: string; address?: string | null } | null;
  job_line_items: { description: string }[];
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
  email: string | null;
};

type Availability = {
  id: string;
  team_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Client = {
  id: string;
  name: string;
};

type BookingRequest = {
  id: string;
  client_id: string;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  status: string;
  clients: { name: string; phone: string | null } | null;
};

export default async function CalendarPage() {
  const supabase = await createClient();

  let businessId: string | null = null;
  let jobs: Job[] = [];
  let team: TeamMember[] = [];
  let availability: Availability[] = [];
  let clients: Client[] = [];
  let availTableMissing = false;
  let bookingRequests: BookingRequest[] = [];
  let bookingTableMissing = false;
  let unavailDates: string[] = [];
  let schedulingSettings: {
    unavailable_days: number[];
    day_hours: Record<string, { from: string; until: string }>;
  } = { unavailable_days: [], day_hours: {} };
  let defaultCrewSize = 1;
  let smartSchedulingEnabled = true;

  const bizId = await getBusinessId(supabase);

  if (bizId) {
    businessId = bizId;

    const [
      { data: bizData },
      { data: jobsData },
      { data: teamData },
      availResult,
      { data: clientsData },
      bookingResult,
      { data: blockedData },
      { data: settingsData },
      { data: crewSettingsData },
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select("smart_scheduling_enabled")
        .eq("id", bizId)
        .single(),
      supabase
        .from("jobs")
        .select("id, status, total, scheduled_at, clients(name, address), job_line_items(description)")
        .eq("business_id", bizId)
        .not("scheduled_at", "is", null)
        .order("scheduled_at"),
      supabase
        .from("team_members")
        .select("id, name, role, email")
        .eq("business_id", bizId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("worker_availability")
        .select("id, team_member_id, day_of_week, start_time, end_time")
        .eq("business_id", bizId),
      supabase
        .from("clients")
        .select("id, name")
        .eq("business_id", bizId)
        .order("name"),
      supabase
        .from("booking_requests")
        .select("id, client_id, requested_date, requested_time, notes, status, clients(name, phone)")
        .eq("business_id", bizId)
        .eq("status", "pending")
        .order("requested_date"),
      supabase
        .from("blocked_dates")
        .select("blocked_date")
        .eq("business_id", bizId),
      supabase
        .from("scheduling_settings")
        .select("unavailable_days, day_hours")
        .eq("business_id", bizId)
        .maybeSingle(),
      supabase
        .from("business_crew_settings")
        .select("crew_size")
        .eq("business_id", bizId)
        .maybeSingle(),
    ]);

    if (bizData) {
      smartSchedulingEnabled =
        (bizData as unknown as { smart_scheduling_enabled: boolean }).smart_scheduling_enabled ?? true;
    }

    jobs = (jobsData as unknown as Job[]) ?? [];
    team = teamData ?? [];
    clients = clientsData ?? [];

    if (availResult.error?.message?.includes("does not exist")) {
      availTableMissing = true;
    } else {
      availability = availResult.data ?? [];
    }

    if (bookingResult.error?.message?.includes("does not exist")) {
      bookingTableMissing = true;
    } else {
      bookingRequests = (bookingResult.data as unknown as BookingRequest[]) ?? [];
    }

    if (blockedData) {
      unavailDates = blockedData.map((r: { blocked_date: string }) => r.blocked_date);
    }
    if (settingsData) {
      schedulingSettings = {
        unavailable_days: settingsData.unavailable_days ?? [],
        day_hours: settingsData.day_hours ?? {},
      };
    }
    if (crewSettingsData) {
      defaultCrewSize = (crewSettingsData as unknown as { crew_size: number }).crew_size ?? 1;
    }
  }

  return (
    <CalendarClient
      initialJobs={jobs}
      initialTeam={team}
      initialAvailability={availability}
      initialClients={clients}
      initialBusinessId={businessId}
      initialAvailTableMissing={availTableMissing}
      initialBookingRequests={bookingRequests}
      initialBookingTableMissing={bookingTableMissing}
      initialUnavailDates={unavailDates}
      initialSchedulingSettings={schedulingSettings}
      initialDefaultCrewSize={defaultCrewSize}
      initialSmartSchedulingEnabled={smartSchedulingEnabled}
    />
  );
}
