import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Caller must be an owner (has a business row)
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  // Prevent owner from deleting their own account via this endpoint
  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Use the standard Delete Account flow to delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { users }, error: listError } = await admin.auth.admin.listUsers();
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const target = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!target) return NextResponse.json({ error: "No account found with that email" }, { status: 404 });

  // Clean up any businesses or team_member rows for this user
  await admin.from("businesses").delete().eq("owner_id", target.id);
  await admin.from("team_members").delete().eq("user_id", target.id);

  const { error } = await admin.auth.admin.deleteUser(target.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
