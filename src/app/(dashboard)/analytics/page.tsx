import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import { type ServicePlan } from "@/components/analytics/MrrChart";
import AnalyticsClient, { type Job, type Quote, type Member } from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const businessId = await getBusinessId(supabase);

  let jobs: Job[] = [];
  let quotes: Quote[] = [];
  let teamMembers: Member[] = [];
  let totalExpenses = 0;
  let plans: ServicePlan[] = [];
  let currency = "USD";

  if (businessId) {
    const { data: bizData } = await supabase
      .from("businesses")
      .select("currency")
      .eq("id", businessId)
      .single();
    currency = bizData?.currency ?? "USD";

    const [jobsRes, quotesRes, membersRes, expensesRes, plansRes] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, status, total, created_at, service_type, assigned_member_id, clients(name, lead_source), payments(status)")
        .eq("business_id", businessId),
      supabase
        .from("quotes")
        .select("id, status, total, created_at")
        .eq("business_id", businessId),
      supabase
        .from("team_members")
        .select("id, name, role")
        .eq("business_id", businessId)
        .eq("is_active", true),
      supabase
        .from("expenses")
        .select("amount")
        .eq("business_id", businessId),
      supabase
        .from("service_plans")
        .select("frequency, price, status")
        .eq("business_id", businessId),
    ]);

    jobs = (jobsRes.data as unknown as Job[]) ?? [];
    quotes = (quotesRes.data as Quote[]) ?? [];
    teamMembers = (membersRes.data as Member[]) ?? [];
    totalExpenses = ((expensesRes.data ?? []) as { amount: number }[]).reduce((s, e) => s + e.amount, 0);
    // service_plans table may not exist yet — handle gracefully
    if (!plansRes.error) plans = (plansRes.data as ServicePlan[]) ?? [];
  }

  return (
    <AnalyticsClient
      initialJobs={jobs}
      initialQuotes={quotes}
      initialTeamMembers={teamMembers}
      initialTotalExpenses={totalExpenses}
      initialPlans={plans}
      initialCurrency={currency}
    />
  );
}
