import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import PayoutsClient, {
  type MemberRow,
  type LaborRow,
  type CommissionRow,
  type BatchRow,
} from "./PayoutsClient";

export default async function PayoutsPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/");

  const businessId = await getBusinessId(supabase);
  if (!businessId) redirect("/");

  // Business currency (falls back to USD in the client).
  const { data: biz } = await supabase
    .from("businesses")
    .select("currency")
    .eq("id", businessId)
    .maybeSingle();

  const [membersRes, laborRes, commissionRes, batchesRes] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("is_active", true),
    supabase
      .from("job_payouts")
      .select("team_member_id, amount, status")
      .eq("business_id", businessId)
      .in("status", ["pending", "owed"]),
    supabase
      .from("commission_entries")
      .select("member_id, amount, status")
      .eq("business_id", businessId)
      .not("member_id", "is", null)
      .in("status", ["pending", "owed"]),
    supabase
      .from("payout_batches")
      .select(
        "id, member_id, labor_total, commission_total, total_amount, method, created_at, team_members(name)"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <PayoutsClient
      businessId={businessId}
      currency={(biz?.currency as string) ?? "USD"}
      initialMembers={(membersRes.data as unknown as MemberRow[]) ?? []}
      initialLabor={(laborRes.data as unknown as LaborRow[]) ?? []}
      initialCommission={(commissionRes.data as unknown as CommissionRow[]) ?? []}
      initialBatches={(batchesRes.data as unknown as BatchRow[]) ?? []}
    />
  );
}
