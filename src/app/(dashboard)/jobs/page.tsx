import { createClient } from "@/lib/supabase/server";
import JobsClient from "./JobsClient";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
  job_crew: { team_member_id: string }[];
};

type CrewMember = { id: string; name: string };

type TomorrowJob = {
  id: string;
  scheduled_at: string;
  service_type: string | null;
  clients: { name: string; phone: string | null } | null;
};

export default async function JobsPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;

  const fullName: string =
    (claims?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    (claims?.email as string | undefined) ??
    "";
  const firstName = fullName.split(" ")[0] || "";

  if (!userId) {
    return (
      <JobsClient
        initialJobs={[]}
        initialFirstName={firstName}
        initialBusinessId={null}
        initialCurrency="USD"
        initialSmsReminders={false}
        initialBusinessName=""
        initialServiceAreas={[]}
        initialTomorrowJobs={[]}
        initialReminderTemplates={{}}
        initialTeamMembers={[]}
        initialAllPayments={[]}
        initialOutstandingCount={0}
        initialOutstandingAmount={0}
      />
    );
  }

  const { data: biz } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!biz) {
    return (
      <JobsClient
        initialJobs={[]}
        initialFirstName={firstName}
        initialBusinessId={null}
        initialCurrency="USD"
        initialSmsReminders={false}
        initialBusinessName=""
        initialServiceAreas={[]}
        initialTomorrowJobs={[]}
        initialReminderTemplates={{}}
        initialTeamMembers={[]}
        initialAllPayments={[]}
        initialOutstandingCount={0}
        initialOutstandingAmount={0}
      />
    );
  }

  const businessId = biz.id;
  const currency = (biz as unknown as { currency: string }).currency ?? "USD";
  const smsReminders = (biz as unknown as { sms_reminders_enabled: boolean }).sms_reminders_enabled ?? false;
  const businessName = (biz as unknown as { name: string }).name ?? "";
  const areas: string[] = (biz as unknown as { service_areas: string[] | null }).service_areas ?? [];
  // Fallback: legacy single-city field
  const legacyCity = (biz as unknown as { city: string | null }).city;
  const allAreas = areas.length ? areas : (legacyCity ? [legacyCity] : []);

  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 1, 0, 1);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStart = new Date(tomorrow);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const [{ data }, { data: weekPayments }, { data: completedJobs }, { data: tomorrowData }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, total, scheduled_at, completed_at, created_at, notes, clients(name, address), job_line_items(description), job_crew(team_member_id)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase.from("payments").select("amount, paid_at").eq("business_id", businessId)
      .eq("status", "paid").gte("paid_at", twoYearsAgo.toISOString()),
    supabase.from("jobs").select("id, total, payments(id)")
      .eq("business_id", businessId).eq("status", "completed"),
    supabase
      .from("jobs")
      .select("id, scheduled_at, service_type, clients(name, phone)")
      .eq("business_id", businessId)
      .eq("status", "scheduled")
      .gte("scheduled_at", tomorrowStart.toISOString())
      .lte("scheduled_at", tomorrowEnd.toISOString())
      .order("scheduled_at"),
  ]);

  const { data: tmplData } = await supabase
    .from("message_templates")
    .select("service_type, body")
    .eq("business_id", businessId)
    .eq("message_type", "reminder");
  const reminderTemplates: Record<string, string> = {};
  (tmplData ?? []).forEach((r: { service_type: string; body: string }) => { reminderTemplates[r.service_type] = r.body; });

  const jobList = (data as unknown as Job[]) ?? [];
  const tomorrowJobs = (tomorrowData as unknown as TomorrowJob[]) ?? [];

  const { data: teamMembersData } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name");
  const assignedIds = new Set(jobList.flatMap((j) => j.job_crew.map((c) => c.team_member_id)));
  const teamMembers = ((teamMembersData ?? []) as CrewMember[]).filter((m) => assignedIds.has(m.id));

  const allPayments = (weekPayments as unknown as { amount: number; paid_at: string }[]) ?? [];
  const unpaid = (completedJobs ?? []).filter(
    (j: { payments: { id: string }[] }) => !j.payments || j.payments.length === 0
  );
  const outstandingCount = unpaid.length;
  const outstandingAmount = (unpaid as { total: number }[]).reduce((s, j) => s + j.total, 0);

  return (
    <JobsClient
      initialJobs={jobList}
      initialFirstName={firstName}
      initialBusinessId={businessId}
      initialCurrency={currency}
      initialSmsReminders={smsReminders}
      initialBusinessName={businessName}
      initialServiceAreas={allAreas}
      initialTomorrowJobs={tomorrowJobs}
      initialReminderTemplates={reminderTemplates}
      initialTeamMembers={teamMembers}
      initialAllPayments={allPayments}
      initialOutstandingCount={outstandingCount}
      initialOutstandingAmount={outstandingAmount}
    />
  );
}
