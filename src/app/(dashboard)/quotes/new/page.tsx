import { createClient } from "@/lib/supabase/server";
import NewQuoteClient from "./NewQuoteClient";

type Service = {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string | null;
};

type Client = {
  id: string;
  name: string;
  tag: string;
};

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: preselect } = await searchParams;
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let businessId: string | null = null;
  let currency = "USD";
  let services: Service[] = [];
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

      const [{ data: servicesData }, { data: clientsData }] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, price, unit, category")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("category")
          .order("name"),
        supabase
          .from("clients")
          .select("id, name, tag")
          .eq("business_id", business.id)
          .order("name"),
      ]);

      services = (servicesData ?? []) as Service[];
      clients = (clientsData ?? []) as Client[];
    }
  }

  return (
    <NewQuoteClient
      initialBusinessId={businessId}
      initialCurrency={currency}
      initialServices={services}
      initialClients={clients}
      preselectClientId={preselect ?? null}
    />
  );
}
