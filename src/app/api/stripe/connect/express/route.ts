import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await request.json();
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  // Verify user owns this business
  const { data: business } = await supabase
    .from("businesses")
    .select("id, stripe_connect_account_id, stripe_connect_status")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  let accountId = business.stripe_connect_account_id as string | null;

  // If no account yet, create one
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { business_id: businessId, supabase_user_id: user.id },
    });
    accountId = account.id;

    await supabase
      .from("businesses")
      .update({
        stripe_connect_account_id: accountId,
        stripe_connect_type: "express",
        stripe_connect_status: "pending",
      })
      .eq("id", businessId);
  }

  // Create (or refresh) account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/settings?connect=refresh`,
    return_url: `${origin}/settings?connect=return`,
  });

  return NextResponse.json({ url: accountLink.url });
}
