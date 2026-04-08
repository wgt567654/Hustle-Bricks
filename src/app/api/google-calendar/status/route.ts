import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";

export async function GET() {
  const supabase = await createClient();
  const businessId = await getBusinessId(supabase);

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("calendar_id")
    .eq("business_id", businessId)
    .single();

  return NextResponse.json({
    connected: !!data,
    calendarId: data?.calendar_id ?? null,
  });
}
