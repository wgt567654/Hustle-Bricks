import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

function verifyState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [businessId, receivedHmac] = parts;
  const secret = process.env.STRIPE_CONNECT_CLIENT_ID ?? process.env.STRIPE_SECRET_KEY!;
  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(businessId)
    .digest("hex")
    .slice(0, 16);
  const valid = crypto.timingSafeEqual(
    Buffer.from(receivedHmac),
    Buffer.from(expectedHmac)
  );
  return valid ? businessId : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  if (error) {
    return NextResponse.redirect(`${origin}/settings?connect=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?connect=error&reason=missing_params`);
  }

  const businessId = verifyState(state);
  if (!businessId) {
    return NextResponse.redirect(`${origin}/settings?connect=error&reason=invalid_state`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Verify this business belongs to the authenticated user
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    return NextResponse.redirect(`${origin}/settings?connect=error&reason=unauthorized`);
  }

  // Exchange OAuth code for Stripe account ID
  const token = await stripe.oauth.token({
    grant_type: "authorization_code",
    code,
  });

  const stripeAccountId = token.stripe_user_id;
  if (!stripeAccountId) {
    return NextResponse.redirect(`${origin}/settings?connect=error&reason=no_account`);
  }

  // Standard accounts are immediately active
  await supabase
    .from("businesses")
    .update({
      stripe_connect_account_id: stripeAccountId,
      stripe_connect_type: "standard",
      stripe_connect_status: "active",
    })
    .eq("id", businessId);

  return NextResponse.redirect(`${origin}/settings?connect=success`);
}
