import { createClient } from "@/lib/supabase/server";
import PayrollReportClient from "./PayrollReportClient";

type TimeEntry = {
  id: string;
  employee_id: string;
  job_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  team_members: { name: string } | null;
};

type AssignedJob = {
  id: string;
  assigned_member_id: string;
  status: string;
  completed_at: string | null;
};

export default async function PayrollPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  const { data: business } = userId
    ? await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", userId)
        .single()
    : { data: null };

  // Default filter on the client is "month" — provide the matching initial
  // dataset so the first paint is server-rendered without a client fetch.
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  let entries: TimeEntry[] = [];
  let assignedJobs: AssignedJob[] = [];

  if (business) {
    const [{ data: entryData }, { data: jobData }] = await Promise.all([
      supabase
        .from("time_entries")
        .select("id, employee_id, job_id, clocked_in_at, clocked_out_at, odometer_start, odometer_end, team_members(name)")
        .eq("business_id", business.id)
        .gte("clocked_in_at", startDate.toISOString())
        .lte("clocked_in_at", endDate.toISOString())
        .not("clocked_out_at", "is", null),
      supabase
        .from("jobs")
        .select("id, assigned_member_id, status, completed_at")
        .eq("business_id", business.id)
        .eq("status", "completed")
        .not("assigned_member_id", "is", null)
        .gte("completed_at", startDate.toISOString())
        .lte("completed_at", endDate.toISOString()),
    ]);

    entries = (entryData as unknown as TimeEntry[]) ?? [];
    assignedJobs = (jobData as unknown as AssignedJob[]) ?? [];
  }

  return (
    <PayrollReportClient
      initialEntries={entries}
      initialAssignedJobs={assignedJobs}
      businessId={business?.id ?? null}
    />
  );
}
