"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeMembership } from "./employee-membership";

export const ACTIVE_BUSINESS_COOKIE = "hb_active_business";

export function getActiveBusinessCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACTIVE_BUSINESS_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function setActiveBusinessCookie(businessId: string) {
  document.cookie = `${ACTIVE_BUSINESS_COOKIE}=${encodeURIComponent(
    businessId
  )}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Resolve the employee's active membership (multi-team aware).
 * Replaces the old `.from("team_members").eq("user_id", ...).single()`
 * pattern, which errors when a worker belongs to more than one business.
 */
export async function getActiveMembership(supabase: SupabaseClient): Promise<{
  membership: EmployeeMembership | null;
  memberships: EmployeeMembership[];
}> {
  const { data, error } = await supabase.rpc("get_my_memberships");
  const memberships: EmployeeMembership[] = error ? [] : (data ?? []);
  const activeOnes = memberships.filter((m) => m.is_active);
  const preferred = getActiveBusinessCookie();
  const membership =
    activeOnes.find((m) => m.business_id === preferred) ?? activeOnes[0] ?? null;
  return { membership, memberships };
}
