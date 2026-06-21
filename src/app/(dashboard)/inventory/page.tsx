import { createClient } from "@/lib/supabase/server";
import InventoryClient from "./InventoryClient";

type Category = "equipment" | "vehicle" | "part";
type Condition = "excellent" | "good" | "fair" | "poor";

type InventoryItem = {
  id: string;
  name: string;
  category: Category;
  condition: Condition;
  quantity: number;
  min_quantity: number;
  location: string | null;
  serial_number: string | null;
  purchase_cost: number | null;
  current_value: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  is_active: boolean;
  inventory_assignments: { id: string; returned_at: string | null; team_member_id: string | null }[];
};

type TeamMember = { id: string; name: string };

export default async function InventoryPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let items: InventoryItem[] = [];
  let teamMembers: TeamMember[] = [];
  let businessId: string | null = null;
  let currency = "USD";

  if (userId) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, currency")
      .eq("owner_id", userId)
      .maybeSingle();

    if (biz) {
      businessId = biz.id;
      currency = (biz as unknown as { currency: string }).currency ?? "USD";

      const [{ data: invData }, { data: tmData }] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("id, name, category, condition, quantity, min_quantity, location, serial_number, purchase_cost, current_value, vehicle_make, vehicle_model, vehicle_year, is_active, inventory_assignments(id, returned_at, team_member_id)")
          .eq("business_id", biz.id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("team_members")
          .select("id, name")
          .eq("business_id", biz.id)
          .eq("is_active", true)
          .order("name"),
      ]);

      items = (invData as unknown as InventoryItem[]) ?? [];
      teamMembers = (tmData as TeamMember[]) ?? [];
    }
  }

  return (
    <InventoryClient
      initialItems={items}
      initialTeamMembers={teamMembers}
      initialBusinessId={businessId}
      initialCurrency={currency}
    />
  );
}
