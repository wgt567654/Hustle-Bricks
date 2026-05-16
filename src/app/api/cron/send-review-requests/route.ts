import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  // Vercel cron passes CRON_SECRET as a Bearer token.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find completed jobs where:
  // - completed between 20 and 28 hours ago (catches the nightly 8pm UTC window)
  // - review request not yet sent
  // - the business has review requests enabled
  // - the client has a phone number
  // - the business has a google review URL set
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select(`
      id,
      business_id,
      completed_at,
      clients ( name, phone ),
      businesses ( name, review_requests_enabled, google_review_url )
    `)
    .eq("status", "completed")
    .is("review_request_sent_at", null)
    .gte("completed_at", new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString())
    .lte("completed_at", new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error("[review-requests cron] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type JobRow = {
    id: string;
    business_id: string;
    completed_at: string;
    clients: { name: string; phone: string | null } | null;
    businesses: { name: string; review_requests_enabled: boolean; google_review_url: string | null } | null;
  };

  const eligible = (jobs as unknown as JobRow[]).filter(
    (j) =>
      j.businesses?.review_requests_enabled === true &&
      j.businesses?.google_review_url &&
      j.clients?.phone
  );

  let sent = 0;
  let skipped = 0;

  for (const job of eligible) {
    const clientName = job.clients!.name.split(" ")[0];
    const bizName = job.businesses!.name;
    const reviewUrl = job.businesses!.google_review_url!;
    const phone = job.clients!.phone!;

    const body =
      `Hi ${clientName}! This is ${bizName}. We just finished up and hope everything looks great. ` +
      `If we did a good job, would you mind leaving us a quick review? It means the world to us:\n${reviewUrl}`;

    const result = await sendSMS({
      to: phone,
      body,
      businessId: job.business_id,
      metadata: { type: "review_request", job_id: job.id },
    });

    if (result.success || result.id) {
      await supabaseAdmin
        .from("jobs")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", job.id);
      sent++;
    } else {
      skipped++;
    }
  }

  console.log(`[review-requests cron] sent=${sent} skipped=${skipped} total_eligible=${eligible.length}`);
  return NextResponse.json({ sent, skipped });
}
