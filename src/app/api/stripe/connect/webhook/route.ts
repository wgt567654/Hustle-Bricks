import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// This endpoint must be registered in Stripe Dashboard as a CONNECT webhook
// (not a regular account webhook), so it receives events from all connected accounts.
// Register at: Stripe Dashboard → Connect → Webhooks
// Events to enable:
//   account.updated
//   invoice.payment_succeeded
//   invoice.payment_failed
//   customer.subscription.updated
//   customer.subscription.deleted

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
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      if (
        account.charges_enabled &&
        account.payouts_enabled &&
        account.details_submitted
      ) {
        await supabase
          .from("businesses")
          .update({ stripe_connect_status: "active" })
          .eq("stripe_connect_account_id", account.id);
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subRef === "string" ? subRef : (subRef as Stripe.Subscription | undefined)?.id;

      if (!subscriptionId) break;

      // Find the client_billing_subscription so we can get business_id and client_id
      const { data: sub } = await supabase
        .from("client_billing_subscriptions")
        .select("id, business_id, client_id")
        .eq("stripe_subscription_id", subscriptionId)
        .single();

      if (!sub) break;

      // Record payment — idempotent check on invoice id (payment_intent removed in Stripe SDK v20)
      const stripePaymentId = invoice.id;
      const { data: existing } = await supabase
        .from("payments")
        .select("id")
        .eq("stripe_payment_id", stripePaymentId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("payments").insert({
          business_id: sub.business_id,
          status: "paid",
          method: "card",
          amount: invoice.amount_paid / 100,
          stripe_payment_id: stripePaymentId,
          paid_at: new Date((invoice.status_transitions?.paid_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          notes: `Recurring billing — ${invoice.lines?.data?.[0]?.description ?? "subscription"}`,
        });
      }

      // Update next billing date
      const nextBillingDate = invoice.lines?.data?.[0]?.period?.end
        ? new Date((invoice.lines.data[0].period.end as number) * 1000).toISOString()
        : null;

      if (nextBillingDate) {
        await supabase
          .from("client_billing_subscriptions")
          .update({ next_billing_date: nextBillingDate, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscriptionId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subRef === "string" ? subRef : (subRef as Stripe.Subscription | undefined)?.id;

      if (!subscriptionId) break;

      await supabase
        .from("client_billing_subscriptions")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscriptionId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("client_billing_subscriptions")
        .update({ status: sub.status, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", sub.id);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("client_billing_subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
