import { createClient } from "@/lib/supabase/server";
import ProfitabilityClient from "./ProfitabilityClient";

type TimeEntry = {
  job_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  team_members: { hourly_rate: number | null } | null;
};

type Expense = {
  job_id: string;
  amount: number;
};

type Job = {
  id: string;
  total: number;
  completed_at: string | null;
  clients: { name: string } | null;
};

export default async function ProfitabilityPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let jobs: Job[] = [];
  let timeEntries: TimeEntry[] = [];
  let expenses: Expense[] = [];

  const { data: business } = userId
    ? await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", userId)
        .single()
    : { data: null };

  if (business) {
    // Default range = current month (mirrors the client's initial "month" filter).
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [{ data: jobData }, { data: entryData }, { data: expenseData }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, total, completed_at, clients(name)")
        .eq("business_id", business.id)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .gte("completed_at", startDate.toISOString())
        .lte("completed_at", endDate.toISOString())
        .order("completed_at", { ascending: false }),
      supabase
        .from("time_entries")
        .select("job_id, clocked_in_at, clocked_out_at, team_members(hourly_rate)")
        .eq("business_id", business.id)
        .not("clocked_out_at", "is", null),
      supabase
        .from("expenses")
        .select("job_id, amount")
        .eq("business_id", business.id),
    ]);

    jobs = (jobData as unknown as Job[]) ?? [];
    timeEntries = (entryData as unknown as TimeEntry[]) ?? [];
    expenses = (expenseData as Expense[]) ?? [];
  }

  return (
    <ProfitabilityClient
      initialJobs={jobs}
      initialTimeEntries={timeEntries}
      initialExpenses={expenses}
    />
  );
}
