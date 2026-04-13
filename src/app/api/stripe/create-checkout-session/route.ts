import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

const PRICE_IDS: Record<string, Record<string, string>> = {
  solo:     { monthly: process.env.STRIPE_PRICE_SOLO_MONTHLY!,     yearly: process.env.STRIPE_PRICE_SOLO_YEARLY! },
  team:     { monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY!,     yearly: process.env.STRIPE_PRICE_TEAM_YEARLY! },
  business: { monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY!, yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY! },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan, interval, businessId } = await req.json() as {
    plan: "solo" | "team" | "business";
    interval: "monthly" | "yearly";
    businessId: string;
  };

  const priceId = PRICE_IDS[plan]?.[interval];
  if (!priceId) return NextResponse.json({ error: "Invalid plan or interval" }, { status: 400 });

  // Verify user owns this business
  const { data: business } = await supabase
    .from("businesses")
    .select("id, stripe_customer_id")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // Create or retrieve Stripe customer
  let customerId = business.stripe_customer_id as string | null;
  if (!customerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.full_name ?? undefined,
      metadata: { supabase_user_id: user.id, business_id: businessId },
    });
    customerId = customer.id;

    await supabase
      .from("businesses")
      .update({ stripe_customer_id: customerId })
      .eq("id", businessId);
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { business_id: businessId, plan },
    },
    success_url: `${origin}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/onboarding?step=4`,
    metadata: { business_id: businessId, plan },
  });

  return NextResponse.json({ url: session.url });
}
