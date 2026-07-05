import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

// Service-role client: the invoice payer is anonymous (no Supabase session),
// so RLS would block reads/writes. All authorization here comes from verifying
// the PaymentIntent against the business's own connected Stripe account.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  let body: { paymentIntentId?: unknown; jobId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Only paymentIntentId and jobId are read from the client.
  // Any client-supplied stripeAccount is deliberately ignored — the connected
  // account is resolved server-side from the job's business record.
  const paymentIntentId =
    typeof body.paymentIntentId === "string" ? body.paymentIntentId : null;
  const jobId = typeof body.jobId === "string" ? body.jobId : null;

  if (!paymentIntentId || !jobId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = adminClient();

  // Resolve the job and its business's stored Stripe Connect account.
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, business_id, businesses(stripe_connect_account_id, stripe_connect_status)"
    )
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const business = Array.isArray(job.businesses)
    ? job.businesses[0]
    : job.businesses;

  if (
    !business?.stripe_connect_account_id ||
    business.stripe_connect_status !== "active"
  ) {
    return NextResponse.json({ error: "Payment not allowed" }, { status: 403 });
  }

  // Retrieve the PaymentIntent from the business's own connected account ONLY.
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      { stripeAccount: business.stripe_connect_account_id }
    );
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (paymentIntent.status !== "succeeded") {
    return NextResponse.json(
      { error: "Payment not confirmed" },
      { status: 400 }
    );
  }

  // The PaymentIntent must have been created for this exact job
  // (create-payment-intent stamps metadata.jobId at creation time).
  if (paymentIntent.metadata?.jobId !== jobId) {
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 403 }
    );
  }

  // The recorded amount always comes from Stripe, never from the client.
  const amount = paymentIntent.amount / 100;

  // Idempotency: one payments row per PaymentIntent.
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_payment_id", paymentIntent.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyRecorded: true });
  }

  const { error: insertError } = await supabase.from("payments").insert({
    job_id: jobId,
    business_id: job.business_id,
    status: "paid",
    method: "card",
    amount,
    stripe_payment_id: paymentIntent.id,
    paid_at: new Date().toISOString(),
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Could not record payment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
