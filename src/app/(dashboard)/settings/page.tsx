import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsClient, { type SettingsBusiness } from "./SettingsClient";

type SettingsCustomField = { id: string; label: string; field_type: "text" | "number" | "boolean" | "select"; options: string[]; required: boolean; position: number };

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;

  if (!userId) {
    redirect("/");
  }

  const userEmail = (claims?.email as string | undefined) ?? null;
  const ownerName =
    ((claims?.user_metadata as { full_name?: string } | undefined)?.full_name) ??
    userEmail?.split("@")[0] ??
    "";

  // Mirror the original owner_id-direct business query exactly.
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Only redirect if there is truly no business for this user (not on query errors).
  if (!business && !businessError) {
    redirect("/");
  }
  if (!business) {
    redirect("/");
  }

  const [{ data: schedSettings }, { data: crewSettings }, { data: cfData }] = await Promise.all([
    supabase
      .from("scheduling_settings")
      .select("unavailable_days, day_hours")
      .eq("business_id", business.id)
      .maybeSingle(),
    supabase
      .from("business_crew_settings")
      .select("crew_size")
      .eq("business_id", business.id)
      .maybeSingle(),
    supabase
      .from("canvassing_custom_fields")
      .select("*")
      .eq("business_id", business.id)
      .order("position"),
  ]);

  const initialSchedulingSettings = schedSettings
    ? {
        unavailable_days: (schedSettings as { unavailable_days: number[] }).unavailable_days ?? [0, 6],
        day_hours: (schedSettings as { day_hours: Record<number, { from: string; until: string }> }).day_hours ?? {},
      }
    : null;

  const initialCrewSize = crewSettings ? ((crewSettings as { crew_size: number }).crew_size ?? 1) : 1;
  const initialCustomFields = (cfData as unknown as SettingsCustomField[]) ?? [];

  return (
    <SettingsClient
      initialBusiness={business as unknown as SettingsBusiness}
      initialUserEmail={userEmail}
      initialOwnerName={ownerName}
      initialSchedulingSettings={initialSchedulingSettings}
      initialCrewSize={initialCrewSize}
      initialCustomFields={initialCustomFields}
    />
  );
}
