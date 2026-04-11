import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Uses the service role key so this works without user auth.
// The service role key is NEVER exposed to the browser — this runs server-side only.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { business_id, name, email, phone, property_type, services, frequency, address, source } = body;

  if (!business_id || !name) {
    return NextResponse.json({ error: "business_id and name are required" }, { status: 400 });
  }

  const supabase = adminClient();

  // Verify the business exists (prevents inserts with fake business IDs)
  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", business_id)
    .single();

  if (bizError || !biz) {
    return NextResponse.json({ error: "Invalid business" }, { status: 404 });
  }

  // Build notes summary from form data so it's visible in the existing leads UI
  const notesParts: string[] = [];
  if (property_type) notesParts.push(`Property: ${property_type}`);
  if (services && services.length > 0) notesParts.push(`Services: ${(services as string[]).join(", ")}`);
  if (frequency) notesParts.push(`Frequency: ${frequency}`);

  const { error } = await supabase.from("leads").insert({
    business_id,
    name: String(name).trim(),
    email: email || null,
    phone: phone || null,
    address: address || null,
    stage: "new",
    source: source || "Website",
    notes: notesParts.length > 0 ? notesParts.join(" · ") : null,
    property_type: property_type || null,
    services: services || null,
    frequency: frequency || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
