import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The three follow-up steps: [step number, delay in hours, message builder]
const STEPS: [number, number, (firstName: string, bizName: string) => string][] = [
  [1, 24,  (n, b) => `Hi ${n}, just checking in on the quote we sent from ${b}. Any questions? We're happy to walk you through it!`],
  [2, 72,  (n, b) => `Hi ${n}, ${b} here again. Did you get a chance to look over your quote? Let us know if you'd like to adjust anything or move forward!`],
  [3, 168, (n, b) => `Hi ${n}, last check-in from ${b} on your quote. We'd love to earn your business — just reply here or give us a call. Thanks!`],
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all sent quotes where:
  // - status is still 'sent' (accepted/declined quotes are automatically skipped)
  // - sent_at is set (the trigger sets this; old quotes without it are ignored)
  // - the business has follow_up_enabled
  // - the client has a phone number
  const { data: quotes, error } = await supabaseAdmin
    .from("quotes")
    .select(`
      id,
      business_id,
      sent_at,
      clients ( name, phone ),
      businesses ( name, follow_up_enabled ),
      quote_follow_up_sends ( step )
    `)
    .eq("status", "sent")
    .not("sent_at", "is", null);

  if (error) {
    console.error("[quote-follow-ups cron] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type QuoteRow = {
    id: string;
    business_id: string;
    sent_at: string;
    clients: { name: string; phone: string | null } | null;
    businesses: { name: string; follow_up_enabled: boolean } | null;
    quote_follow_up_sends: { step: number }[];
  };

  const eligible = (quotes as unknown as QuoteRow[]).filter(
    (q) => q.businesses?.follow_up_enabled === true && q.clients?.phone
  );

  let sent = 0;
  let skipped = 0;
  const now = Date.now();

  for (const quote of eligible) {
    const sentAt = new Date(quote.sent_at).getTime();
    const alreadySentSteps = new Set(quote.quote_follow_up_sends.map((s) => s.step));
    const firstName = quote.clients!.name.split(" ")[0];
    const bizName = quote.businesses!.name;
    const phone = quote.clients!.phone!;

    for (const [step, delayHours, buildMessage] of STEPS) {
      if (alreadySentSteps.has(step)) continue;
      if (now < sentAt + delayHours * 60 * 60 * 1000) continue;

      const body = buildMessage(firstName, bizName);
      const result = await sendSMS({
        to: phone,
        body,
        businessId: quote.business_id,
        metadata: { type: "quote_follow_up", quote_id: quote.id, step },
      });

      if (result.id) {
        await supabaseAdmin.from("quote_follow_up_sends").insert({
          quote_id: quote.id,
          business_id: quote.business_id,
          step,
          sms_queue_id: result.id,
        });
        sent++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`[quote-follow-ups cron] sent=${sent} skipped=${skipped} quotes_checked=${eligible.length}`);
  return NextResponse.json({ sent, skipped });
}
