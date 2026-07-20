import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { verifyLinkToken } from "@/lib/link-token";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Signed-link check: quote pages are public but must carry a valid token.
  // Grace mode (QUOTE_LINK_GRACE=true) lets legacy token-less links through;
  // a token that is present but invalid is always rejected.
  const token = req.nextUrl.searchParams.get("t");
  const grace = process.env.QUOTE_LINK_GRACE === "true";
  const allowed = token ? verifyLinkToken("quote", id, token) : grace;
  if (!allowed) {
    return NextResponse.json({ error: "Invalid or missing link token" }, { status: 403 });
  }

  const supabase = adminClient();

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, status, total, notes, video_url, created_at, proposed_date, proposed_time, " +
      "businesses(name, logo_url, invoice_message, terms_and_conditions, currency, financing_enabled, financing_url, financing_min_amount), " +
      "clients(name), " +
      "quote_line_items(id, description, quantity, unit_price)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
