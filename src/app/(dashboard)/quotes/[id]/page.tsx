import { createClient } from "@/lib/supabase/server";
import QuoteDetailClient from "./QuoteDetailClient";

type QuoteStatus = "draft" | "sent" | "accepted" | "declined";

type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type Quote = {
  id: string;
  status: QuoteStatus;
  total: number;
  created_at: string;
  notes: string | null;
  video_url: string | null;
  client_id: string;
  clients: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  quote_line_items: QuoteLineItem[];
};

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let businessId: string | null = null;
  let currency = "USD";

  if (userId) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, currency")
      .eq("owner_id", userId)
      .single();
    if (biz) {
      businessId = biz.id;
      currency = biz.currency ?? "USD";
    }
  }

  const { data, error } = await supabase
    .from("quotes")
    .select("id, status, total, created_at, notes, video_url, client_id, clients(name, phone, email, address), quote_line_items(id, description, quantity, unit_price)")
    .eq("id", id)
    .single();

  let quote: Quote | null = null;
  let linkedJobId: string | null = null;

  if (!error && data) {
    quote = data as unknown as Quote;

    // Check for linked job
    if (quote.status === "accepted" || quote.status === "declined") {
      const { data: jobData } = await supabase
        .from("jobs")
        .select("id")
        .eq("quote_id", id)
        .maybeSingle();
      if (jobData) linkedJobId = jobData.id;
    }
  }

  return (
    <QuoteDetailClient
      initialQuote={quote}
      initialBusinessId={businessId}
      initialCurrency={currency}
      initialLinkedJobId={linkedJobId}
    />
  );
}
