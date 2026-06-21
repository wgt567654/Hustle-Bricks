import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientDetailClient, {
  type ClientDetail,
  type Job,
  type BookingRequest,
  type BillingSub,
} from "./ClientDetailClient";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clientData, error } = await supabase
    .from("clients")
    .select("id, name, email, phone, address, tag, notes, recurring_plan, created_at")
    .eq("id", id)
    .single();

  if (error || !clientData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="font-bold text-foreground">Client not found</p>
        <Link href="/clients" className="text-sm text-primary font-bold">← Back to Clients</Link>
      </div>
    );
  }

  const client = clientData as ClientDetail;

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  const [{ data: jobsData }, { data: biz }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, total, scheduled_at, completed_at, job_line_items(description), payments(status)")
      .eq("client_id", id)
      .order("scheduled_at", { ascending: false }),
    userId
      ? supabase
          .from("businesses")
          .select("id, currency, stripe_connect_status")
          .eq("owner_id", userId)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const jobs = (jobsData as unknown as Job[]) ?? [];

  let businessId: string | null = null;
  let currency = "USD";
  let connectStatus = "not_connected";
  let bookingRequests: BookingRequest[] = [];
  let billingSub: BillingSub | null = null;

  if (biz?.currency) currency = biz.currency;
  if (biz) {
    businessId = biz.id;
    connectStatus =
      (biz as unknown as { stripe_connect_status: string | null }).stripe_connect_status ?? "not_connected";

    const [{ data: reqs }, { data: billingSubs }] = await Promise.all([
      supabase
        .from("booking_requests")
        .select("id, requested_date, requested_time, notes, status, created_at")
        .eq("client_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("client_billing_subscriptions")
        .select("id, stripe_subscription_id, status, amount, currency, interval, interval_count, description, next_billing_date")
        .eq("business_id", biz.id)
        .eq("client_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    bookingRequests = (reqs as BookingRequest[]) ?? [];
    if (billingSubs && billingSubs.length > 0) {
      billingSub = billingSubs[0] as BillingSub;
    }
  }

  return (
    <ClientDetailClient
      id={id}
      initialClient={client}
      initialJobs={jobs}
      initialBusinessId={businessId}
      initialCurrency={currency}
      initialConnectStatus={connectStatus}
      initialBookingRequests={bookingRequests}
      initialBillingSub={billingSub}
    />
  );
}
