import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { clientId, businessId, date, time, notes } = await req.json();

  if (!clientId || !businessId || !date || !time) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("booking_requests").insert({
    client_id: clientId,
    business_id: businessId,
    requested_date: date,
    requested_time: time,
    notes: notes || null,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
