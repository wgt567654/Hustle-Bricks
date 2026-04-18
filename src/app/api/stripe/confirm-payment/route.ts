import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { paymentIntentId, jobId, stripeAccount } = await request.json();

  if (!paymentIntentId || !jobId || !stripeAccount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Retrieve the PaymentIntent from the connected account
  const paymentIntent = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    {},
    { stripeAccount }
  );

  if (paymentIntent.status !== "succeeded") {
    return NextResponse.json({ error: "Payment not confirmed" }, { status: 400 });
  }

  const supabase = await createClient();

  // Idempotency check
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

  // Fetch business_id from the job for the payments record
  const { data: job } = await supabase
    .from("jobs")
    .select("business_id")
    .eq("id", jobId)
    .single();

  await supabase.from("payments").insert({
    job_id: jobId,
    business_id: job?.business_id,
    status: "paid",
    method: "card",
    amount: paymentIntent.amount / 100,
    stripe_payment_id: paymentIntentId,
    paid_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
