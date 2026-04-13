import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const role: "owner" | "admin" | "member" | "sales" = "owner";

  if (!business) {
    const { data: tm } = await supabase
      .from("team_members")
      .select("business_id, role, is_active, is_pending")
      .eq("user_id", user.id)
      .single();

    if (!tm) redirect("/onboarding");

    // Pending employees are awaiting owner approval
    if (!tm.is_active && tm.is_pending) redirect("/employee-pending");

    // Deactivated/removed employees
    if (!tm.is_active) redirect("/onboarding");

    // Active employees go to the employee portal, not the owner dashboard
    redirect("/employee");
  }

  return <Shell role={role}>{children}</Shell>;
}
