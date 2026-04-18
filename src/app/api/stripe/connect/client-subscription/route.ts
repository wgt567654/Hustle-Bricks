import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId, clientId, amount, interval, intervalCount = 1, description } =
    await request.json() as {
      businessId: string;
      clientId: string;
      amount: number;
      interval: "month" | "week" | "year";
      intervalCount?: number;
      description?: string;
    };

  if (!businessId || !clientId || !amount || !interval) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify ownership + active Connect account
  const { data: business } = await supabase
    .from("businesses")
    .select("id, stripe_connect_account_id, stripe_connect_status, currency")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (business.stripe_connect_status !== "active" || !business.stripe_connect_account_id) {
    return NextResponse.json({ error: "Stripe Connect not active" }, { status: 422 });
  }

  const connectAccountId = business.stripe_connect_account_id as string;
  const currency = ((business.currency as string | null) ?? "usd").toLowerCase();

  // Load client details
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("id", clientId)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Create Stripe Customer on the connected account
  const stripeCustomer = await stripe.customers.create(
    {
      email: client.email ?? undefined,
      name: client.name ?? undefined,
      metadata: { client_id: clientId, business_id: businessId },
    },
    { stripeAccount: connectAccountId }
  );

  // Create an inline Price (no reusable product needed)
  const price = await stripe.prices.create(
    {
      unit_amount: Math.round(amount * 100),
      currency,
      recurring: { interval, interval_count: intervalCount },
      product_data: { name: description ?? "Recurring Service" },
    },
    { stripeAccount: connectAccountId }
  );

  // Create the Subscription — send_invoice so Stripe emails the client
  const subscription = await stripe.subscriptions.create(
    {
      customer: stripeCustomer.id,
      items: [{ price: price.id }],
      collection_method: "send_invoice",
      days_until_due: 30,
      metadata: { business_id: businessId, client_id: clientId },
    },
    { stripeAccount: connectAccountId }
  );

  const nextBillingDate = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  // Save to DB
  const { data: row, error: dbError } = await supabase
    .from("client_billing_subscriptions")
    .insert({
      business_id: businessId,
      client_id: clientId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: stripeCustomer.id,
      status: subscription.status,
      amount,
      currency,
      interval,
      interval_count: intervalCount,
      description: description ?? null,
      next_billing_date: nextBillingDate,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, subscription: row });
}
