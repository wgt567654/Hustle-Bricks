import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import type { QuoteStatus } from "@/lib/status-colors";
import QuotesClient from "./QuotesClient";

type Quote = {
  id: string;
  status: QuoteStatus;
  total: number;
  created_at: string;
  clients: { name: string } | null;
  quote_line_items: { description: string }[];
};

export default async function QuotesPage() {
  const supabase = await createClient();

  const businessId = await getBusinessId(supabase);

  let currency = "USD";
  let quotes: Quote[] = [];

  if (businessId) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("currency")
      .eq("id", businessId)
      .maybeSingle();
    currency = biz?.currency ?? "USD";

    const { data } = await supabase
      .from("quotes")
      .select("id, status, total, created_at, clients(name), quote_line_items(description)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    quotes = (data ?? []) as unknown as Quote[];
  }

  return (
    <QuotesClient
      initialQuotes={quotes}
      initialBusinessId={businessId}
      initialCurrency={currency}
    />
  );
}
