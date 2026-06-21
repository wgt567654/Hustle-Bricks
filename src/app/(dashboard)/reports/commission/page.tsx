import { createClient } from "@/lib/supabase/server";
import CommissionReportClient from "./CommissionReportClient";

type Member = {
  id: string;
  name: string;
  role: string;
  commission_rate: number | null;
};

type Job = {
  id: string;
  total: number;
  completed_at: string | null;
  assigned_member_id: string | null;
};

export default async function CommissionPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let members: Member[] = [];
  let jobs: Job[] = [];
  let defaultRate = 5;

  const { data: biz } = userId
    ? await supabase
        .from("businesses")
        .select("id, commission_rate")
        .eq("owner_id", userId)
        .single()
    : { data: null };

  if (biz) {
    defaultRate = biz.commission_rate ?? 5;

    // Default range = current month (mirrors the client's initial "month" filter).
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [{ data: memberData }, { data: jobData }] = await Promise.all([
      supabase
        .from("team_members")
        .select("id, name, role, commission_rate")
        .eq("business_id", biz.id)
        .eq("is_active", true),
      supabase
        .from("jobs")
        .select("id, total, completed_at, assigned_member_id")
        .eq("business_id", biz.id)
        .eq("status", "completed")
        .not("assigned_member_id", "is", null)
        .not("completed_at", "is", null)
        .gte("completed_at", startDate.toISOString())
        .lte("completed_at", endDate.toISOString()),
    ]);

    members = (memberData as Member[]) ?? [];
    jobs = (jobData as Job[]) ?? [];
  }

  return (
    <CommissionReportClient
      initialMembers={members}
      initialJobs={jobs}
      initialDefaultRate={defaultRate}
    />
  );
}
