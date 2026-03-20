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

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  let role: "owner" | "admin" | "member" | "sales" = "owner";

  if (!business) {
    const { data: tm } = await supabase
      .from("team_members")
      .select("business_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!tm) redirect("/onboarding");
    role = tm.role as "admin" | "member" | "sales";
  }

  return <Shell role={role}>{children}</Shell>;
}
