import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmployeeShell from "./EmployeeShell";
import ThemeStyle from "@/components/ThemeStyle";
import { getCustomization } from "@/lib/customization";
import { getEmployeeContext } from "@/lib/employee-membership";

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

  // Must be an active team member (not an owner logging in here directly).
  // A worker can hold memberships in several businesses; the cookie-selected
  // one (else the first active) is the one this session operates as.
  const { memberships, active, pendingOnly } = await getEmployeeContext(supabase);

  if (pendingOnly) redirect("/employee-pending");
  if (!active) redirect("/onboarding");

  const customization = await getCustomization(supabase, active.business_id);

  const switchable = memberships
    .filter((m) => m.is_active)
    .map((m) => ({ businessId: m.business_id, businessName: m.business_name }));

  return (
    <>
      <ThemeStyle theme={customization.theme} />
      <EmployeeShell
        employeeName={active.member_name}
        memberships={switchable}
        activeBusinessId={active.business_id}
      >
        {children}
      </EmployeeShell>
    </>
  );
}
