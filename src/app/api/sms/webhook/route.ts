import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Twilio delivers incoming SMS as an HTTP POST with application/x-www-form-urlencoded body.
// Required fields: From (sender), To (your Twilio number), Body (message text).
// Returns TwiML — an empty <Response/> means "no auto-reply".
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return NextResponse.json({ error: "Bad content type" }, { status: 400 });
  }

  const formData = await req.formData();
  const fromPhone = formData.get("From") as string | null;
  const toPhone   = formData.get("To")   as string | null;
  const body      = formData.get("Body") as string | null;
  const twilioSid = formData.get("MessageSid") as string | null;

  if (!fromPhone || !toPhone || !body) {
    return twiml(); // always return valid TwiML so Twilio doesn't retry
  }

  // Find the business that owns this Twilio number.
  // Falls back to TWILIO_FROM_NUMBER env var for single-number deployments.
  const twilioFromEnv = process.env.TWILIO_FROM_NUMBER ?? "";
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .or(`twilio_number.eq.${toPhone},twilio_number.eq.${twilioFromEnv}`)
    .limit(1)
    .maybeSingle();

  // If no explicit match, fall back to env-number match across all businesses
  let businessId: string | null = business?.id ?? null;
  if (!businessId && twilioFromEnv && toPhone === twilioFromEnv) {
    // Single-number setup: assign to the business whose number matches env
    const { data: anyBiz } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .limit(1)
      .maybeSingle();
    businessId = anyBiz?.id ?? null;
  }

  if (!businessId) return twiml();

  // Find client by their phone number (normalized)
  const normalized = normalizePhone(fromPhone);
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", normalized ?? fromPhone)
    .maybeSingle();

  await supabaseAdmin.from("sms_messages").insert({
    business_id: businessId,
    client_id:   client?.id ?? null,
    direction:   "inbound",
    from_phone:  fromPhone,
    to_phone:    toPhone,
    body:        body.trim(),
    twilio_sid:  twilioSid,
    read_at:     null, // unread until owner opens thread
  });

  return twiml();
}

function twiml() {
  return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}
