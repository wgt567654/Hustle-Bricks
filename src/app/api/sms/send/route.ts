import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: { to: string; body: string; businessId: string; clientId: string } = await req.json();
  const { to, body: text, businessId, clientId } = body;

  if (!to || !text || !businessId || !clientId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify this owner owns this business
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .single();

  if (!biz) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await sendSMS({
    to,
    body: text,
    businessId,
    clientId,
    metadata: { type: "manual_reply", client_id: clientId },
  });

  return NextResponse.json(result);
}
