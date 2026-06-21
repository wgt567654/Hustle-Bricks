import { createClient } from "@/lib/supabase/server";
import CanvassingLeadsClient from "./CanvassingLeadsClient";

type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";

type CanvassingLead = {
  id: string;
  name: string;
  phone: string | null;
  phone_alt: string | null;
  email: string | null;
  address: string | null;
  stage: LeadStage;
  source: string | null;
  rapport_notes: string | null;
  service_notes: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  created_at: string;
};

export default async function CanvassingLeadsPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let businessId: string | null = null;
  let leads: CanvassingLead[] = [];

  if (userId) {
    const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", userId).single();
    if (biz) {
      businessId = biz.id;
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, phone_alt, email, address, stage, source, rapport_notes, service_notes, preferred_date, preferred_time, notes, created_at")
        .eq("business_id", biz.id)
        .ilike("source", "%canvass%")
        .order("created_at", { ascending: false });
      leads = (data as CanvassingLead[]) ?? [];
    }
  }

  return <CanvassingLeadsClient initialLeads={leads} initialBusinessId={businessId} />;
}
