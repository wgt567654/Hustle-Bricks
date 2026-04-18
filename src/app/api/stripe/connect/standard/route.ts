import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// Generates a signed nonce so the OAuth state param isn't just a raw businessId.
// We encode businessId + a HMAC so the callback can verify it without a DB roundtrip.
function signState(businessId: string): string {
  const secret = process.env.STRIPE_CONNECT_CLIENT_ID ?? process.env.STRIPE_SECRET_KEY!;
  const hmac = crypto.createHmac("sha256", secret).update(businessId).digest("hex").slice(0, 16);
  return `${businessId}.${hmac}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.redirect(new URL("/settings", request.url));

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const state = signState(business.id);
  const redirectUri = `${origin}/api/stripe/connect/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
    scope: "read_write",
    state,
    redirect_uri: redirectUri,
  });

  return NextResponse.redirect(
    `https://connect.stripe.com/oauth/authorize?${params.toString()}`
  );
}
