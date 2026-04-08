import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";

export async function DELETE() {
  const supabase = await createClient();
  const businessId = await getBusinessId(supabase);

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("google_calendar_tokens")
    .delete()
    .eq("business_id", businessId);

  return NextResponse.json({ ok: true });
}
