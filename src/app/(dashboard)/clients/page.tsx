import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import ClientsClient from "./ClientsClient";

type Tag = "residential" | "commercial" | "vip";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tag: Tag;
  notes: string | null;
};

export default async function ClientsPage() {
  const supabase = await createClient();

  const businessId = await getBusinessId(supabase);

  let clients: Client[] = [];
  if (businessId) {
    const { data } = await supabase
      .from("clients")
      .select("id, name, email, phone, address, tag, notes")
      .eq("business_id", businessId)
      .order("name");
    clients = (data ?? []) as Client[];
  }

  return <ClientsClient initialClients={clients} initialBusinessId={businessId} />;
}
