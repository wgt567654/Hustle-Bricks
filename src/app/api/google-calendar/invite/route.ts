import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import { inviteTeamMember } from "@/lib/google-calendar";

export async function POST() {
  const supabase = await createClient();
  const businessId = await getBusinessId(supabase);

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: members } = await supabase
    .from("team_members")
    .select("email, name")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .not("email", "is", null);

  if (!members || members.length === 0) {
    return NextResponse.json({ invited: 0, skipped: 0 });
  }

  let invited = 0;
  let skipped = 0;

  for (const member of members) {
    if (!member.email) { skipped++; continue; }
    try {
      await inviteTeamMember(businessId, member.email);
      invited++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ invited, skipped });
}
