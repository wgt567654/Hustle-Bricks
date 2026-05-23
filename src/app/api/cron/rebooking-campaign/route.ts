import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms";

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all businesses with rebooking enabled
  const { data: businesses, error: bizError } = await supabaseAdmin
    .from("businesses")
    .select("id, name, rebooking_after_days")
    .eq("rebooking_enabled", true);

  if (bizError) {
    console.error("[rebooking-campaign cron] biz query error:", bizError.message);
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  type BusinessRow = { id: string; name: string; rebooking_after_days: number };
  type JobRow = {
    client_id: string;
    completed_at: string;
    clients: { id: string; name: string; phone: string | null; last_rebooking_sent_at: string | null } | null;
  };

  let sent = 0;
  let skipped = 0;

  for (const biz of (businesses as BusinessRow[]) ?? []) {
    const afterDays = biz.rebooking_after_days ?? 60;
    const jobCutoff = new Date(Date.now() - afterDays * 86_400_000).toISOString();
    // Don't re-send to the same client within the same window
    const recontactCutoff = new Date(Date.now() - afterDays * 86_400_000).toISOString();

    // Get all completed jobs older than the threshold for this business, with client info.
    // We'll group client-side to find each client's most recent job.
    const { data: jobs, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("client_id, completed_at, clients(id, name, phone, last_rebooking_sent_at)")
      .eq("business_id", biz.id)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (jobError) {
      console.error(`[rebooking-campaign cron] jobs query error for biz ${biz.id}:`, jobError.message);
      continue;
    }

    // Build a map of client_id → most recent completed job
    const latestJobByClient = new Map<string, JobRow>();
    for (const j of (jobs as unknown as JobRow[]) ?? []) {
      if (!j.client_id || latestJobByClient.has(j.client_id)) continue;
      latestJobByClient.set(j.client_id, j);
    }

    for (const [, job] of latestJobByClient) {
      const client = job.clients;
      if (!client?.phone) continue;

      // Skip if their most recent job is too recent
      if (job.completed_at >= jobCutoff) continue;

      // Skip if we've already sent a rebooking SMS recently
      if (client.last_rebooking_sent_at && client.last_rebooking_sent_at >= recontactCutoff) continue;

      const firstName = client.name.split(" ")[0];
      const body =
        `Hi ${firstName}! It's ${biz.name} — it's been a while since your last service. ` +
        `We'd love to have you back! Just reply here and we'll get you scheduled. 😊`;

      const result = await sendSMS({
        to: client.phone,
        body,
        businessId: biz.id,
        metadata: { type: "rebooking_campaign", client_id: client.id },
      });

      if (result.id) {
        await supabaseAdmin
          .from("clients")
          .update({ last_rebooking_sent_at: new Date().toISOString() })
          .eq("id", client.id);
        sent++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`[rebooking-campaign cron] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ sent, skipped });
}
