import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const businessId = session.metadata?.business_id;
    const plan = session.metadata?.plan;
    const subscriptionId = session.subscription as string | null;

    if (businessId && plan && subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await supabase
        .from("businesses")
        .update({
          plan,
          stripe_subscription_id: subscriptionId,
          subscription_status: subscription.status,
        })
        .eq("id", businessId);
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const businessId = subscription.metadata?.business_id;
    const plan = subscription.metadata?.plan;

    if (businessId) {
      await supabase
        .from("businesses")
        .update({
          subscription_status: subscription.status,
          ...(plan ? { plan } : {}),
        })
        .eq("id", businessId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const businessId = subscription.metadata?.business_id;

    if (businessId) {
      await supabase
        .from("businesses")
        .update({ subscription_status: "canceled" })
        .eq("id", businessId);
    }
  }

  return NextResponse.json({ received: true });
}
