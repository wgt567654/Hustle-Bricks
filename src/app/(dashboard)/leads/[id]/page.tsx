import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LeadDetailClient, {
  type Lead,
  type CustomField,
  type LeadPhoto,
  type TeamMember,
} from "./LeadDetailClient";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: leadData } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (!leadData) redirect("/leads");
  const lead = leadData as Lead;

  const [{ data: cfs }, { data: ph }, { data: members }] = await Promise.all([
    supabase.from("canvassing_custom_fields")
      .select("id, label, field_type, options, required, position")
      .eq("business_id", lead.business_id)
      .order("position"),
    supabase.from("lead_photos")
      .select("id, url, caption, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("team_members")
      .select("id, name")
      .eq("business_id", lead.business_id)
      .eq("is_active", true)
      .eq("is_pending", false)
      .order("name"),
  ]);

  return (
    <LeadDetailClient
      initialLead={lead}
      initialCustomFields={(cfs as CustomField[]) ?? []}
      initialPhotos={(ph as LeadPhoto[]) ?? []}
      initialTeamMembers={(members as TeamMember[]) ?? []}
    />
  );
}
