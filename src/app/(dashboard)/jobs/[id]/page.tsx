import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import JobDetailClient from "./JobDetailClient";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "custom" | null;

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
};

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  service_type: string | null;
  recurrence_frequency: RecurrenceFrequency;
  recurrence_interval_days: number | null;
  business_id: string | null;
  client_id: string | null;
  quote_id: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  duration_mins: number | null;
  assigned_member_id: string | null;
  crew_size: number;
  clients: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  job_line_items: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  job_crew: { team_member_id: string; team_members: { id: string; name: string } | null }[];
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;

  if (!userId) {
    return (
      <JobDetailClient
        initialJob={null}
        initialExpenses={[]}
        initialBusinessId={null}
        initialCurrency="USD"
        initialBusinessName=""
        initialOwnerName=""
        initialSmsRemindersEnabled={false}
        notFound
      />
    );
  }

  const bizId = await getBusinessId(supabase);
  if (!bizId) {
    return (
      <JobDetailClient
        initialJob={null}
        initialExpenses={[]}
        initialBusinessId={null}
        initialCurrency="USD"
        initialBusinessName=""
        initialOwnerName=""
        initialSmsRemindersEnabled={false}
        notFound
      />
    );
  }

  const { data: bizData } = await supabase
    .from("businesses")
    .select("currency, name, sms_reminders_enabled")
    .eq("id", bizId)
    .single();
  const currency = bizData?.currency ?? "USD";
  const businessName = bizData?.name ?? "";
  const smsRemindersEnabled =
    (bizData as unknown as { sms_reminders_enabled: boolean } | null)?.sms_reminders_enabled ?? false;
  const email = claims?.email as string | undefined;
  const ownerName =
    (claims?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    email?.split("@")[0] ??
    "";

  const [{ data, error }, { data: expData }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, total, scheduled_at, completed_at, notes, service_type, recurrence_frequency, recurrence_interval_days, business_id, client_id, quote_id, before_photo_url, after_photo_url, duration_mins, assigned_member_id, crew_size, clients(name, phone, email, address), job_line_items(id, description, quantity, unit_price), job_crew(team_member_id, team_members(id, name))")
      .eq("id", id)
      .eq("business_id", bizId)
      .single(),
    supabase
      .from("expenses")
      .select("id, description, amount, category, created_at")
      .eq("job_id", id)
      .order("created_at"),
  ]);

  if (error || !data) {
    return (
      <JobDetailClient
        initialJob={null}
        initialExpenses={[]}
        initialBusinessId={bizId}
        initialCurrency={currency}
        initialBusinessName={businessName}
        initialOwnerName={ownerName}
        initialSmsRemindersEnabled={smsRemindersEnabled}
        notFound
      />
    );
  }

  const jobData = data as unknown as Job;
  jobData.job_crew = jobData.job_crew ?? [];
  jobData.crew_size = jobData.crew_size ?? 1;
  const expenses = (expData as unknown as Expense[]) ?? [];

  return (
    <JobDetailClient
      initialJob={jobData}
      initialExpenses={expenses}
      initialBusinessId={bizId}
      initialCurrency={currency}
      initialBusinessName={businessName}
      initialOwnerName={ownerName}
      initialSmsRemindersEnabled={smsRemindersEnabled}
      notFound={false}
    />
  );
}
