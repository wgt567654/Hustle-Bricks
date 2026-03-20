import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";


export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const jobId = paymentIntent.metadata?.jobId;

    if (jobId) {
      const supabase = await createClient();

      // Idempotency: skip if already recorded
      const { data: existing } = await supabase
        .from("payments")
        .select("id")
        .eq("job_id", jobId)
        .eq("method", "card")
        .eq("status", "paid")
        .maybeSingle();

      if (!existing) {
        await supabase.from("payments").insert({
          job_id: jobId,
          status: "paid",
          method: "card",
          amount: paymentIntent.amount / 100,
          paid_at: new Date().toISOString(),
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
