import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AutomationsClient from "./AutomationsClient";

export default async function AutomationsPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/");

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, follow_up_enabled, payment_reminders_enabled, review_requests_enabled, rebooking_enabled, rebooking_after_days"
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!business) redirect("/settings");

  return (
    <AutomationsClient
      businessId={business.id}
      initialFlags={{
        follow_up_enabled: !!business.follow_up_enabled,
        payment_reminders_enabled: !!business.payment_reminders_enabled,
        review_requests_enabled: !!business.review_requests_enabled,
        rebooking_enabled: !!business.rebooking_enabled,
      }}
      initialRebookingDays={business.rebooking_after_days ?? 180}
    />
  );
}
