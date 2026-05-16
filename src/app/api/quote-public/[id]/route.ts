import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = adminClient();

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, status, total, notes, video_url, created_at, " +
      "businesses(name, currency, financing_enabled, financing_url, financing_min_amount), " +
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
