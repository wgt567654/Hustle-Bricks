import { createClient } from "@/lib/supabase/server";
import ServicesClient from "./ServicesClient";

type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  unit: "flat" | "per_hour" | "per_sqft" | "per_item";
  duration_mins: number | null;
};

export default async function ServicesPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let businessId: string | null = null;
  let currency = "USD";
  let services: Service[] = [];

  if (userId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id, currency")
      .eq("owner_id", userId)
      .single();

    if (business) {
      businessId = business.id;
      currency = business.currency ?? "USD";

      const { data } = await supabase
        .from("services")
        .select("id, name, description, category, price, unit, duration_mins")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("category")
        .order("name");

      services = (data ?? []) as Service[];
    }
  }

  return (
    <ServicesClient
      initialServices={services}
      initialBusinessId={businessId}
      initialCurrency={currency}
    />
  );
}
