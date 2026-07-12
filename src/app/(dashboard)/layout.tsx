import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import ThemeStyle from "@/components/ThemeStyle";
import { getCustomization } from "@/lib/customization";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect("/");

  // onboarding_completed_at comes from onboarding_v3.sql; fall back to the
  // plain query (no setup gate) until the owner runs that migration.
  let business: {
    id: string;
    onboarding_completed_at?: string | null;
    subscription_status?: string | null;
  } | null = null;
  let setupGate = true;
  {
    const { data, error } = await supabase
      .from("businesses")
      .select("id, onboarding_completed_at, subscription_status")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      setupGate = false;
      const { data: fallback } = await supabase
        .from("businesses")
        .select("id, subscription_status")
        .eq("owner_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      business = fallback;
    } else {
      business = data;
    }
  }

  const role: "owner" | "admin" | "member" | "sales" = "owner";

  if (!business) {
    const { data: tm } = await supabase
      .from("team_members")
      .select("business_id, role, is_active, is_pending")
      .eq("user_id", userId)
      .single();

    if (!tm) redirect("/onboarding");

    // Pending employees are awaiting owner approval
    if (!tm.is_active && tm.is_pending) redirect("/employee-pending");

    // Deactivated/removed employees
    if (!tm.is_active) redirect("/onboarding");

    // Active employees go to the employee portal, not the owner dashboard
    redirect("/employee");
  }

  // Owners finish the guided setup before entering the app
  if (setupGate && !business.onboarding_completed_at) redirect("/onboarding");

  // Trial ended without a card → account is paused; send them to pick a plan.
  // Data is untouched — subscribing again restores full access.
  if (business.subscription_status === "paused") redirect("/onboarding");

  const customization = await getCustomization(supabase, business.id);

  return (
    <>
      <ThemeStyle theme={customization.theme} />
      <Shell role={role} modules={customization.modules}>
        {children}
      </Shell>
    </>
  );
}
