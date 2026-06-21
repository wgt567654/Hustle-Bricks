import { createClient } from "@/lib/supabase/server";
import MileageReportClient from "./MileageReportClient";

type TeamMember = { id: string; name: string; home_address: string | null };

type MileageRecord = {
  id: string;
  date: string;
  total_miles: number;
  rate_per_mile: number;
  reimbursement: number;
  route_snapshot: { origin: string; stops: string[] } | null;
};

export default async function MileageReportPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  const { data: biz } = userId
    ? await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", userId)
        .single()
    : { data: null };

  let members: TeamMember[] = [];
  let selectedId = "";
  let records: MileageRecord[] = [];

  if (biz) {
    const { data } = await supabase
      .from("team_members")
      .select("id, name, home_address")
      .eq("business_id", biz.id)
      .eq("is_active", true)
      .order("name");
    members = (data ?? []) as TeamMember[];

    if (members[0]) {
      selectedId = members[0].id;
      const { data: recordData } = await supabase
        .from("daily_mileage")
        .select("id, date, total_miles, rate_per_mile, reimbursement, route_snapshot")
        .eq("employee_id", selectedId)
        .order("date", { ascending: false })
        .limit(60);
      records = (recordData ?? []) as MileageRecord[];
    }
  }

  return (
    <MileageReportClient
      initialMembers={members}
      initialSelectedId={selectedId}
      initialRecords={records}
    />
  );
}
