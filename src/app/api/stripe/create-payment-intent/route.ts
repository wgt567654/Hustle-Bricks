import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { jobId } = await request.json();

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, total")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(job.total * 100),
    currency: "usd",
    metadata: { jobId },
    description: `Invoice #JB-${jobId.slice(0, 6).toUpperCase()}`,
    automatic_payment_methods: { enabled: true },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
