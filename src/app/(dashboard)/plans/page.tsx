import { createClient } from "@/lib/supabase/server";
import PlansClient from "./PlansClient";

type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";
type PlanStatus = "active" | "paused" | "cancelled";

type Plan = {
  id: string;
  client_id: string;
  name: string;
  frequency: Frequency;
  price: number;
  status: PlanStatus;
  next_service_date: string | null;
  notes: string | null;
  clients: { id: string; name: string } | null;
};

type Client = { id: string; name: string };

export default async function PlansPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let businessId: string | null = null;
  let currency = "USD";
  let plans: Plan[] = [];
  let clients: Client[] = [];

  if (userId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id, currency")
      .eq("owner_id", userId)
      .single();

    if (business) {
      businessId = business.id;
      currency = business.currency ?? "USD";

      const [{ data: plansData }, { data: clientsData }] = await Promise.all([
        supabase
          .from("service_plans")
          .select("id, client_id, name, frequency, price, status, next_service_date, notes, clients(id, name)")
          .eq("business_id", business.id)
          .order("next_service_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("clients")
          .select("id, name")
          .eq("business_id", business.id)
          .order("name"),
      ]);

      plans = (plansData as unknown as Plan[]) ?? [];
      clients = clientsData ?? [];
    }
  }

  return (
    <PlansClient
      initialPlans={plans}
      initialClients={clients}
      initialBusinessId={businessId}
      initialCurrency={currency}
    />
  );
}
