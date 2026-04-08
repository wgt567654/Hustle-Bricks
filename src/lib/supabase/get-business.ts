import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the business ID for the currently authenticated user.
 * Checks owner first, then team member.
 */
export async function getBusinessId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try owner first
  const { data: bizList } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);
  if (bizList && bizList.length > 0) return bizList[0].id;

  // Try team member
  const { data: tm } = await supabase
    .from("team_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();
  return tm?.business_id ?? null;
}
