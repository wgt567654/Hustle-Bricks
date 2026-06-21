import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import BookingsClient, { type BookingRequest } from "./BookingsClient";

export default async function BookingsPage() {
  const supabase = await createClient();
  const businessId = await getBusinessId(supabase);

  let initialRequests: BookingRequest[] = [];
  if (businessId) {
    const { data } = await supabase
      .from("booking_requests")
      .select("id, requested_date, requested_time, notes, created_at, client_id, clients(id, name, address)")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    initialRequests = (data as unknown as BookingRequest[]) ?? [];
  }

  return <BookingsClient initialRequests={initialRequests} businessId={businessId} />;
}
