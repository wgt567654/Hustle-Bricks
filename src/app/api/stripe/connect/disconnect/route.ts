import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await request.json();
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id, stripe_connect_account_id, stripe_connect_type")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!business.stripe_connect_account_id) {
    return NextResponse.json({ error: "No connected account" }, { status: 400 });
  }

  // Block disconnect if active client billing subscriptions exist
  const { count } = await supabase
    .from("client_billing_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "active");

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cancel all ${count} active recurring billing subscription${count === 1 ? "" : "s"} before disconnecting Stripe.` },
      { status: 422 }
    );
  }

  const connectType = business.stripe_connect_type as string | null;
  const accountId = business.stripe_connect_account_id as string;

  if (connectType === "express") {
    try {
      await stripe.accounts.del(accountId);
    } catch {
      // Account may already be deleted — continue
    }
  } else if (connectType === "standard") {
    try {
      await stripe.oauth.deauthorize({
        client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
        stripe_user_id: accountId,
      });
    } catch {
      // May already be deauthorized — continue
    }
  }

  await supabase
    .from("businesses")
    .update({
      stripe_connect_account_id: null,
      stripe_connect_status: "not_connected",
      stripe_connect_type: null,
    })
    .eq("id", businessId);

  return NextResponse.json({ ok: true });
}
