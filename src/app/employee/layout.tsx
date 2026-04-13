import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmployeeShell from "./EmployeeShell";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Must be an active team member (not an owner logging in here directly)
  const { data: tm } = await supabase
    .from("team_members")
    .select("id, name, business_id, is_active, is_pending")
    .eq("user_id", user.id)
    .single();

  if (!tm) redirect("/onboarding");
  if (!tm.is_active && tm.is_pending) redirect("/employee-pending");
  if (!tm.is_active) redirect("/onboarding");

  return (
    <EmployeeShell employeeName={tm.name}>
      {children}
    </EmployeeShell>
  );
}
