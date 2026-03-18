import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { paymentIntentId, jobId } = await request.json();

  if (!paymentIntentId || !jobId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify with Stripe that the payment actually succeeded
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== "succeeded") {
    return NextResponse.json({ error: "Payment not confirmed" }, { status: 400 });
  }

  const supabase = await createClient();

  // Check if we already recorded this payment (idempotency)
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("job_id", jobId)
    .eq("method", "card")
    .eq("status", "paid")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyRecorded: true });
  }

  await supabase.from("payments").insert({
    job_id: jobId,
    status: "paid",
    method: "card",
    amount: paymentIntent.amount / 100,
    paid_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
