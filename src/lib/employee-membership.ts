import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVE_BUSINESS_COOKIE = "hb_active_business";

export type EmployeeMembership = {
  member_id: string;
  member_name: string;
  business_id: string;
  business_name: string;
  is_active: boolean;
  is_pending: boolean;
};

export type EmployeeContext = {
  memberships: EmployeeMembership[];
  /** The membership the employee is currently operating as (cookie-selected, else first active). */
  active: EmployeeMembership | null;
  /** True when any membership is awaiting owner approval and none is active yet. */
  pendingOnly: boolean;
};

export async function getEmployeeContext(
  supabase: SupabaseClient
): Promise<EmployeeContext> {
  const { data, error } = await supabase.rpc("get_my_memberships");
  const memberships: EmployeeMembership[] = error ? [] : (data ?? []);

  const activeOnes = memberships.filter((m) => m.is_active);
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  const active =
    activeOnes.find((m) => m.business_id === preferred) ?? activeOnes[0] ?? null;

  return {
    memberships,
    active,
    pendingOnly: !active && memberships.some((m) => m.is_pending),
  };
}
