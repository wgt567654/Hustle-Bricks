import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  const { subscriptionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Look up the subscription and verify ownership
  const { data: sub } = await supabase
    .from("client_billing_subscriptions")
    .select("id, stripe_subscription_id, businesses(id, owner_id, stripe_connect_account_id)")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

  const businesses = Array.isArray(sub.businesses) ? sub.businesses[0] : sub.businesses;
  if (!businesses || businesses.owner_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const connectAccountId = businesses.stripe_connect_account_id as string;

  // Cancel on Stripe
  await stripe.subscriptions.cancel(
    sub.stripe_subscription_id,
    {},
    { stripeAccount: connectAccountId }
  );

  // Update DB
  await supabase
    .from("client_billing_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  return NextResponse.json({ ok: true });
}
