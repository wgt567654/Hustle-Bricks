import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import LeadsClient from "./LeadsClient";

type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  phone_alt: string | null;
  email: string | null;
  address: string | null;
  stage: LeadStage;
  source: string | null;
  notes: string | null;
  rapport_notes: string | null;
  service_notes: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  custom_field_values: Record<string, unknown> | null;
  estimated_value: number | null;
  referral_job_id: string | null;
  created_at: string;
  ai_score: number | null;
  ai_score_label: "hot" | "warm" | "cool" | "cold" | null;
};

export default async function LeadsPage() {
  const supabase = await createClient();

  const businessId = await getBusinessId(supabase);

  let leads: Lead[] = [];
  if (businessId) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    leads = (data ?? []) as Lead[];
  }

  return <LeadsClient initialLeads={leads} initialBusinessId={businessId} />;
}
