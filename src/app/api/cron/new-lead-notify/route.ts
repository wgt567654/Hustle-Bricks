import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find leads that:
  // - were created in the last 24 hours (no point speed-contacting older leads)
  // - have not yet been notified
  // - belong to a business with lead_notify_enabled = true
  // - have a phone number to contact
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select(`
      id,
      business_id,
      name,
      phone,
      created_at,
      businesses ( name, lead_notify_enabled )
    `)
    .is("notified_at", null)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error("[new-lead-notify cron] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type LeadRow = {
    id: string;
    business_id: string;
    name: string;
    phone: string | null;
    created_at: string;
    businesses: { name: string; lead_notify_enabled: boolean } | null;
  };

  const eligible = (leads as unknown as LeadRow[]).filter(
    (l) => l.businesses?.lead_notify_enabled === true && l.phone
  );

  let sent = 0;
  let skipped = 0;

  for (const lead of eligible) {
    const firstName = lead.name.split(" ")[0];
    const bizName = lead.businesses!.name;

    const body =
      `Hi ${firstName}! Thanks for reaching out to ${bizName}. ` +
      `We got your request and will be in touch shortly. Talk soon!`;

    const result = await sendSMS({
      to: lead.phone!,
      body,
      businessId: lead.business_id,
      metadata: { type: "lead_speed_to_contact", lead_id: lead.id },
    });

    // Mark as notified whether or not the provider is live.
    // The message is logged in sms_queue either way.
    if (result.id) {
      await supabaseAdmin
        .from("leads")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", lead.id);
      sent++;
    } else {
      skipped++;
    }
  }

  console.log(`[new-lead-notify cron] sent=${sent} skipped=${skipped} total_eligible=${eligible.length}`);
  return NextResponse.json({ sent, skipped });
}
