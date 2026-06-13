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
  const { business_id, name, email, phone, address, services, property_type, notes } = body;

  if (!business_id || !name) {
    return NextResponse.json(
      { error: "business_id and name are required" },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", business_id)
    .single();

  if (bizError || !biz) {
    return NextResponse.json({ error: "Invalid business" }, { status: 404 });
  }

  const notesParts: string[] = ["[Quote Request]"];
  if (property_type) notesParts.push(`Property: ${property_type}`);
  if (services && services.length > 0) notesParts.push(`Services: ${(services as string[]).join(", ")}`);
  if (notes) notesParts.push(notes);

  const { error } = await supabase.from("leads").insert({
    business_id,
    name: String(name).trim(),
    email: email || null,
    phone: phone || null,
    address: address || null,
    stage: "new",
    source: "Quote Request",
    notes: notesParts.join(" · "),
    property_type: property_type || null,
    services: services || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
