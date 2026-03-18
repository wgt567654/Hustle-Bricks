import { createClient } from "@/lib/supabase/server";
import AvailabilityForm from "./AvailabilityForm";

type AssignedJob = {
  id: string;
  status: string;
  scheduled_at: string | null;
  total: number;
  job_line_items: { description: string }[];
  clients: { name: string } | null;
};

export default async function TeamPortalPage({ params }: { params: { memberId: string } }) {
  const { memberId } = params;
  const supabase = await createClient();

  const { data: member, error } = await supabase
    .from("team_members")
    .select("id, name, role, email, business_id")
    .eq("id", memberId)
    .single();

  if (error || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">Team member not found</p>
          <p className="text-sm text-muted-foreground mt-1">This link may be invalid.</p>
        </div>
      </div>
    );
  }

  const { data: availData } = await supabase
    .from("worker_availability")
    .select("id, day_of_week, start_time, end_time")
    .eq("team_member_id", memberId);

  let jobs: AssignedJob[] = [];
  const { data: jobsData, error: jobsErr } = await supabase
    .from("jobs")
    .select("id, status, scheduled_at, total, job_line_items(description), clients(name)")
    .eq("assigned_member_id", memberId)
    .in("status", ["scheduled", "in_progress"])
    .order("scheduled_at");

  if (!jobsErr) jobs = (jobsData as unknown as AssignedJob[]) ?? [];

  return (
    <AvailabilityForm
      memberId={memberId}
      businessId={member.business_id}
      memberName={member.name}
      memberRole={member.role}
      availability={availData ?? []}
      jobs={jobs}
    />
  );
}
