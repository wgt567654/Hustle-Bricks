import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
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

      // Resubscribe: cancel a previous subscription left paused after its
      // trial ended without a card, so the business isn't on two at once.
      const { data: existing } = await supabase
        .from("businesses")
        .select("stripe_subscription_id")
        .eq("id", businessId)
        .single();
      const oldSubId = existing?.stripe_subscription_id as string | null;
      if (oldSubId && oldSubId !== subscriptionId) {
        try {
          const oldSub = await stripe.subscriptions.retrieve(oldSubId);
          if (oldSub.status === "paused" || oldSub.status === "trialing") {
            await stripe.subscriptions.cancel(oldSubId);
          }
        } catch {
          // Old subscription already gone in Stripe — nothing to clean up
        }
      }

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

  if (
    event.type === "customer.subscription.paused" ||
    event.type === "customer.subscription.resumed"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const businessId = subscription.metadata?.business_id;

    if (businessId) {
      await supabase
        .from("businesses")
        .update({ subscription_status: subscription.status })
        .eq("id", businessId);
    }
  }

  if (event.type === "customer.subscription.trial_will_end") {
    const subscription = event.data.object as Stripe.Subscription;
    const hasPaymentMethod = !!subscription.default_payment_method;

    // Only nag people who haven't added a card — their account will pause
    if (!hasPaymentMethod) {
      try {
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        const email = !customer.deleted ? customer.email : null;
        if (email) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hustlebricks.com";
          await resend.emails.send({
            from: "HustleBricks <notifications@hustlebricks.ai>",
            to: email,
            subject: "Your HustleBricks trial ends in 3 days",
            html: `
              <p>Your 7-day free trial ends in 3 days.</p>
              <p>To keep using HustleBricks without interruption, add a payment method now. If you don't, your account will pause when the trial ends — your data stays safe, and you can pick up right where you left off whenever you subscribe.</p>
              <p><a href="${siteUrl}/settings">Add a payment method</a></p>
            `,
          });
        }
      } catch {
        // Email is best-effort — never fail the webhook over it
      }
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
