import { createClient } from "@/lib/supabase/server";
import CommissionReportClient, { type CommissionEntry } from "./CommissionReportClient";

export default async function CommissionPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let entries: CommissionEntry[] = [];
  let selfGenRate = 15;
  let houseRate = 5;

  const { data: biz } = userId
    ? await supabase
        .from("businesses")
        .select("id, commission_rate_self_gen, commission_rate_house")
        .eq("owner_id", userId)
        .single()
    : { data: null };

  if (biz) {
    selfGenRate = Number(biz.commission_rate_self_gen ?? 15);
    houseRate = Number(biz.commission_rate_house ?? 5);

    // Default range = current month (mirrors the client's initial "month" filter).
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const { data: entryData } = await supabase
      .from("commission_entries")
      .select(
        "id, member_id, sold_by_owner, lead_source, rate, job_total, amount, status, owed_at, paid_at, created_at, team_members(name), jobs(id, completed_at, clients(name))"
      )
      .eq("business_id", biz.id)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    entries = (entryData as unknown as CommissionEntry[]) ?? [];
  }

  return (
    <CommissionReportClient
      initialEntries={entries}
      selfGenRate={selfGenRate}
      houseRate={houseRate}
    />
  );
}
