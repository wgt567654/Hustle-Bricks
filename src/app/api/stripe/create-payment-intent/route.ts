import { NextRequest, NextResponse } from "next/server";
import { stripe, platformFeeAmount } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { jobId } = await request.json();

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, total, business_id, businesses(stripe_connect_account_id, stripe_connect_status, currency)")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const business = Array.isArray(job.businesses) ? job.businesses[0] : job.businesses;

  // Require an active connected Stripe account — never fall back to the platform account
  if (!business?.stripe_connect_account_id || business.stripe_connect_status !== "active") {
    return NextResponse.json(
      { error: "no_connect_account", message: "Card payments are not available for this business" },
      { status: 422 }
    );
  }

  const totalCents = Math.round((job.total ?? 0) * 100);
  const currency = (business.currency ?? "usd").toLowerCase();
  const applicationFee = platformFeeAmount(totalCents);

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: totalCents,
      currency,
      application_fee_amount: applicationFee,
      metadata: { jobId, businessId: job.business_id },
      description: `Invoice #JB-${jobId.slice(0, 6).toUpperCase()}`,
      automatic_payment_methods: { enabled: true },
    },
    { stripeAccount: business.stripe_connect_account_id }
  );

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    stripeAccount: business.stripe_connect_account_id,
  });
}
