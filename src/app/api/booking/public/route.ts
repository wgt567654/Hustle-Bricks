import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { business_id, name, email, phone, address, date, time, notes } = body;

  if (!business_id || !name || !date || !time) {
    return NextResponse.json(
      { error: "business_id, name, date, and time are required" },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  // Verify business exists
  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", business_id)
    .single();

  if (bizError || !biz) {
    return NextResponse.json({ error: "Invalid business" }, { status: 404 });
  }

  // Find or create a client record so booking_requests FK is satisfied
  let clientId: string;

  if (email) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("business_id", business_id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      clientId = existing.id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({ business_id, name, email, phone: phone || null, address: address || null })
        .select("id")
        .single();

      if (clientError || !newClient) {
        return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
      }
      clientId = newClient.id;
    }
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({ business_id, name, phone: phone || null, address: address || null })
      .select("id")
      .single();

    if (clientError || !newClient) {
      return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    }
    clientId = newClient.id;
  }

  // Create the booking request
  const { error } = await supabase.from("booking_requests").insert({
    client_id: clientId,
    business_id,
    requested_date: date,
    requested_time: time,
    notes: notes || null,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
