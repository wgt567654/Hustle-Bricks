import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  isOptionalString,
  isOptionalStringArray,
  isRequiredString,
  isUuid,
  LONG_MAX,
} from "@/lib/validation";
import { notifyOwner } from "@/lib/notify-owner";

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
  // Rate limit before any parsing or DB work.
  const rl = rateLimit(`booking-public:${getClientIp(req)}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { business_id, name, email, phone, address, date, time, notes, services, service_ids } = body;

  if (!business_id || !name || !date || !time) {
    return NextResponse.json(
      { error: "business_id, name, date, and time are required" },
      { status: 400 }
    );
  }

  // Input sanity (defense in depth)
  if (!isUuid(business_id)) {
    return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  }
  if (
    !isRequiredString(name) ||
    !isRequiredString(date) ||
    !isRequiredString(time) ||
    !isOptionalString(email) ||
    !isOptionalString(phone) ||
    !isOptionalString(address) ||
    !isOptionalString(notes, LONG_MAX) ||
    !isOptionalStringArray(services, 20) ||
    !isOptionalStringArray(service_ids, 20)
  ) {
    return NextResponse.json(
      { error: "One or more fields are invalid or too long" },
      { status: 400 }
    );
  }
  if (Array.isArray(service_ids) && !service_ids.every((id) => isUuid(id))) {
    return NextResponse.json(
      { error: "One or more fields are invalid or too long" },
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

  // Create the booking request. Requested services are recorded on the notes
  // so the owner sees exactly what the customer asked for.
  const serviceList =
    Array.isArray(services) && services.length > 0 ? services.join(", ") : null;
  const storedNotes = serviceList
    ? `Requested services: ${serviceList}${notes ? `\n${notes}` : ""}`
    : notes || null;

  const { error } = await supabase.from("booking_requests").insert({
    client_id: clientId,
    business_id,
    requested_date: date,
    requested_time: time,
    notes: storedNotes,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort owner notification — notifyOwner never throws, so a failed
  // email/SMS cannot break the customer-facing booking.
  await notifyOwner({
    businessId: business_id,
    subject: "New booking request",
    text: `New booking request from ${name} for ${serviceList ?? "service"} on ${date} at ${time}. Review it in HustleBricks → Bookings.`,
  });

  return NextResponse.json({ success: true });
}
