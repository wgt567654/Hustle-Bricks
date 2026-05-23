import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms";
import { formatCurrency } from "@/lib/currency";

const STEPS: [number, number, (firstName: string, bizName: string, amount: string, link: string) => string][] = [
  [1,  3 * 24, (n, b, a, l) => `Hi ${n}, just a friendly reminder that your invoice of ${a} from ${b} is due. Pay anytime here:\n${l}`],
  [2,  7 * 24, (n, b, a, l) => `Hi ${n}, ${b} here — your invoice of ${a} is still outstanding. Easy payment options available:\n${l}`],
  [3, 14 * 24, (n, b, a, l) => `Hi ${n}, final reminder from ${b} regarding your balance of ${a}. Please pay at your earliest convenience:\n${l}`],
];

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all completed, unpaid jobs where the business has reminders enabled
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select(`
      id,
      total,
      completed_at,
      client_id,
      business_id,
      clients ( id, name, phone ),
      businesses ( id, name, currency, payment_reminders_enabled ),
      payments ( status ),
      payment_reminder_sends ( step )
    `)
    .eq("status", "completed")
    .not("completed_at", "is", null);

  if (error) {
    console.error("[payment-reminders cron] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type JobRow = {
    id: string;
    total: number;
    completed_at: string;
    client_id: string | null;
    business_id: string;
    clients: { id: string; name: string; phone: string | null } | null;
    businesses: { id: string; name: string; currency: string | null; payment_reminders_enabled: boolean } | null;
    payments: { status: string }[];
    payment_reminder_sends: { step: number }[];
  };

  const eligible = (jobs as unknown as JobRow[]).filter((j) => {
    if (j.businesses?.payment_reminders_enabled === false) return false;
    if (!j.clients?.phone) return false;
    // Skip if already paid
    if (j.payments?.some((p) => p.status === "paid")) return false;
    return true;
  });

  let sent = 0;
  let skipped = 0;
  const now = Date.now();

  for (const job of eligible) {
    const completedAt = new Date(job.completed_at).getTime();
    const alreadySentSteps = new Set(job.payment_reminder_sends.map((s) => s.step));
    const firstName = job.clients!.name.split(" ")[0];
    const bizName = job.businesses!.name;
    const currency = job.businesses?.currency ?? "USD";
    const amount = formatCurrency(job.total, currency);
    const invoiceLink = `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${job.id}`;
    const phone = job.clients!.phone!;

    for (const [step, delayHours, buildMessage] of STEPS) {
      if (alreadySentSteps.has(step)) continue;
      if (now < completedAt + delayHours * 60 * 60 * 1000) continue;

      const body = buildMessage(firstName, bizName, amount, invoiceLink);
      const result = await sendSMS({
        to: phone,
        body,
        businessId: job.business_id,
        clientId: job.clients!.id,
        metadata: { type: "payment_reminder", job_id: job.id, step },
      });

      if (result.id) {
        await supabaseAdmin.from("payment_reminder_sends").insert({
          job_id: job.id,
          business_id: job.business_id,
          step,
          sms_queue_id: result.id,
        });
        sent++;
      } else {
        skipped++;
      }

      // Only send one step per job per run
      break;
    }
  }

  console.log(`[payment-reminders cron] sent=${sent} skipped=${skipped} jobs_checked=${eligible.length}`);
  return NextResponse.json({ sent, skipped });
}
