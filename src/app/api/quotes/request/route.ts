import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { attachLeadPhotos, isValidPhotoUrls } from "@/lib/lead-photos";
import {
  isOptionalString,
  isOptionalStringArray,
  isRequiredString,
  isUuid,
  LONG_MAX,
} from "@/lib/validation";

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
  const rl = rateLimit(`quotes-request:${getClientIp(req)}`, {
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
  const { business_id, name, email, phone, address, services, property_type, notes, photo_urls } = body;

  if (!business_id || !name) {
    return NextResponse.json(
      { error: "business_id and name are required" },
      { status: 400 }
    );
  }

  // Input sanity (defense in depth)
  if (!isUuid(business_id)) {
    return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  }
  if (
    !isRequiredString(name) ||
    !isOptionalString(email) ||
    !isOptionalString(phone) ||
    !isOptionalString(address) ||
    !isOptionalString(property_type) ||
    !isOptionalString(notes, LONG_MAX) ||
    !isOptionalStringArray(services) ||
    !isValidPhotoUrls(photo_urls, business_id)
  ) {
    return NextResponse.json(
      { error: "One or more fields are invalid or too long" },
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

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
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
    })
    .select("id")
    .single();

  if (error || !lead) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save request" },
      { status: 500 }
    );
  }

  await attachLeadPhotos(supabase, lead.id, business_id, photo_urls as string[] | undefined);

  return NextResponse.json({ success: true });
}
