import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password, name, code } = await request.json();

  if (!email || !password || !name || !code) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the access code is valid before creating anything
  const { data: lookupData, error: lookupError } = await supabase.rpc(
    "lookup_business_by_code",
    { p_code: code.trim().toUpperCase() }
  );

  if (lookupError || !lookupData?.found) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 400 });
  }

  // Create the user pre-confirmed — no email needed, owner approval is the gate
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: name.trim() },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  return NextResponse.json({ userId: userData.user.id });
}
