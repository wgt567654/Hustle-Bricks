import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InventoryDetailClient, {
  type InventoryItem,
  type Assignment,
  type UsageLog,
  type TeamMember,
  type PresetCrew,
} from "./InventoryDetailClient";

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/inventory");

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, currency")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!biz) redirect("/inventory");

  const currency = (biz as unknown as { currency: string }).currency ?? "USD";

  const [{ data: itemData }, { data: assignData }, { data: usageData }, { data: tmData }, { data: pcData }] =
    await Promise.all([
      supabase.from("inventory_items").select("*").eq("id", id).eq("business_id", biz.id).single(),
      supabase
        .from("inventory_assignments")
        .select("id, assigned_at, returned_at, notes, checkout_group_id, team_members(id, name)")
        .eq("item_id", id)
        .order("assigned_at", { ascending: false }),
      supabase
        .from("inventory_usage")
        .select("id, quantity_used, used_at, notes, jobs(id, clients(name)), team_members(id, name)")
        .eq("item_id", id)
        .order("used_at", { ascending: false }),
      supabase
        .from("team_members")
        .select("id, name")
        .eq("business_id", biz.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("preset_crews")
        .select("id, name, preset_crew_members(team_member_id)")
        .eq("business_id", biz.id)
        .order("name"),
    ]);

  if (!itemData) redirect("/inventory");

  const item = itemData as InventoryItem;
  const assignments = (assignData as unknown as Assignment[]) ?? [];
  const usageLogs = (usageData as unknown as UsageLog[]) ?? [];
  const teamMembers = (tmData as TeamMember[]) ?? [];
  const presetCrews: PresetCrew[] = (
    (pcData ?? []) as unknown as { id: string; name: string; preset_crew_members: { team_member_id: string }[] }[]
  ).map((pc) => ({
    id: pc.id,
    name: pc.name,
    member_ids: (pc.preset_crew_members ?? []).map((m) => m.team_member_id),
  }));

  return (
    <InventoryDetailClient
      initialItem={item}
      initialAssignments={assignments}
      initialUsageLogs={usageLogs}
      initialTeamMembers={teamMembers}
      initialPresetCrews={presetCrews}
      initialCurrency={currency}
    />
  );
}
