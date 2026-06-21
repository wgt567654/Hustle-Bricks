import { createClient } from "@/lib/supabase/server";
import SalesClient, { type Quote } from "./SalesClient";

export default async function SalesPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  const { data: business } = userId
    ? await supabase
        .from("businesses")
        .select("id, currency, stale_quote_days")
        .eq("owner_id", userId)
        .single()
    : { data: null };

  let initialQuotes: Quote[] = [];
  const businessId = business?.id ?? null;
  const currency = business?.currency ?? "USD";
  const staleQuoteDays =
    (business as unknown as { stale_quote_days: number | null } | null)?.stale_quote_days ?? 7;

  if (business) {
    const { data } = await supabase
      .from("quotes")
      .select("id, status, total, created_at, sent_at, notes, clients(name, tag), quote_line_items(description)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    initialQuotes = (data as unknown as Quote[]) ?? [];
  }

  return (
    <SalesClient
      initialQuotes={initialQuotes}
      businessId={businessId}
      currency={currency}
      staleQuoteDays={staleQuoteDays}
    />
  );
}
