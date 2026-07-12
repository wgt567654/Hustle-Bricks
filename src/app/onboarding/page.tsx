import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, getCustomization } from "@/lib/customization";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import {
  AUTOMATION_OPTIONS,
  DEFAULT_DAY_FROM,
  DEFAULT_DAY_UNTIL,
  DEFAULT_WORK_DAYS,
  GOAL_DEFAULT,
  STEPS,
  type StepId,
} from "@/lib/onboarding/config";
import OnboardingWizard from "./OnboardingWizard";
import type { OnboardingAnswers } from "./save";

/* Server shell for the guided setup: preloads everything already saved so the
   wizard resumes exactly where the user left off, then hands off to the
   client. Selects degrade gracefully when owner-run migrations are pending. */

type BizRow = Record<string, unknown> & { id: string };

const V3_SELECT =
  "id, name, business_type, country, currency, subscription_status, tax_rate, venmo_username, cashapp_tag, check_payable_to, city, service_areas, sms_reminders_enabled, payment_reminders_enabled, auto_invoice_enabled, review_requests_enabled, morning_briefing_enabled, onboarding_step, onboarding_completed_at, team_size, business_stage, avg_job_value_range, monthly_revenue_goal, growth_priorities, biggest_challenge, payment_methods";
const BASE_SELECT =
  "id, name, country, currency, subscription_status, tax_rate, venmo_username, cashapp_tag, check_payable_to";
const MIN_SELECT = "id, name, subscription_status";

async function fetchBusiness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<BizRow | null> {
  for (const sel of [V3_SELECT, BASE_SELECT, MIN_SELECT]) {
    const { data, error } = await supabase
      .from("businesses")
      .select(sel)
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!error) return (data as unknown as BizRow) ?? null;
  }
  return null;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: profile }, biz] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", userId)
      .maybeSingle(),
    fetchBusiness(supabase, userId),
  ]);

  const subActive =
    biz?.subscription_status === "active" || biz?.subscription_status === "trialing";
  const savedStep = STEPS.some((s) => s.id === biz?.onboarding_step)
    ? (biz?.onboarding_step as StepId)
    : null;
  const completed = !!biz?.onboarding_completed_at;

  // Subscribed and done (or predating the guided setup) → straight to the app
  if (biz && subActive && (completed || !savedStep)) redirect("/");

  let stepId: StepId;
  if (!profile?.first_name) stepId = "welcome";
  else if (!biz) stepId = "business";
  // Finished setup but subscription lapsed (e.g. trial ended without a card,
  // account paused) → straight to plan selection to resubscribe
  else if (completed && !subActive) stepId = "plan";
  else stepId = savedStep ?? "plan";

  // Returning from the Stripe Connect round-trip → land on the payments step
  if (biz && sp.connect) stepId = "payments";

  // Prefill from everything already saved
  const cust = biz ? await getCustomization(supabase, biz.id) : null;

  // stripe_connect_status lives behind stripe_connect.sql — fetch tolerantly
  let connectStatus: "not_connected" | "pending" | "active" = "not_connected";
  if (biz) {
    const { data: connectRow } = await supabase
      .from("businesses")
      .select("stripe_connect_status")
      .eq("id", biz.id)
      .maybeSingle();
    if (
      connectRow?.stripe_connect_status === "pending" ||
      connectRow?.stripe_connect_status === "active"
    ) {
      connectStatus = connectRow.stripe_connect_status;
    }
  }

  let workDays = DEFAULT_WORK_DAYS;
  let dayFrom = DEFAULT_DAY_FROM;
  let dayUntil = DEFAULT_DAY_UNTIL;
  if (biz) {
    const { data: sched } = await supabase
      .from("scheduling_settings")
      .select("unavailable_days, day_hours")
      .eq("business_id", biz.id)
      .maybeSingle();
    if (sched) {
      const unavailable: number[] = sched.unavailable_days ?? [];
      workDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !unavailable.includes(d));
      const hours = sched.day_hours ?? {};
      const first = Object.values(hours)[0] as
        | { from?: string; until?: string }
        | undefined;
      if (first?.from) dayFrom = first.from;
      if (first?.until) dayUntil = first.until;
    }
  }

  const automations: Record<string, boolean> = {};
  for (const o of AUTOMATION_OPTIONS) {
    const dbVal = biz?.[o.key];
    automations[o.key] = typeof dbVal === "boolean" ? dbVal : o.defaultOn;
  }

  const bizType = (biz?.business_type as string | undefined) ?? "";
  const templateFromCust = cust?.industryTemplate ?? null;
  const templateByName = INDUSTRY_TEMPLATES.find((t) => t.name === bizType)?.id ?? null;
  const industry = templateFromCust ?? templateByName ?? (bizType ? "custom" : null);

  const answers: OnboardingAnswers = {
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    phone: profile?.phone ?? "",
    businessName: (biz?.name as string) ?? "",
    country: (biz?.country as string) ?? "US",
    industry,
    industryLabel: bizType,
    services: [],
    teamSize: (biz?.team_size as string) ?? null,
    stage: (biz?.business_stage as string) ?? null,
    jobValue: (biz?.avg_job_value_range as string) ?? null,
    goal: biz?.monthly_revenue_goal != null ? Number(biz.monthly_revenue_goal) : GOAL_DEFAULT,
    taxRate: biz?.tax_rate != null ? Number(biz.tax_rate) : null,
    paymentMethods: (biz?.payment_methods as string[]) ?? [],
    venmoUsername: (biz?.venmo_username as string) ?? "",
    cashappTag: (biz?.cashapp_tag as string) ?? "",
    checkPayableTo: (biz?.check_payable_to as string) ?? "",
    workDays,
    dayFrom,
    dayUntil,
    city: (biz?.city as string) ?? "",
    serviceAreas: (biz?.service_areas as string[]) ?? [],
    automations,
    accentH: cust?.theme.accentH ?? DEFAULT_THEME.accentH,
    accentC: cust?.theme.accentC ?? DEFAULT_THEME.accentC,
    tone: cust?.aiPersonality.tone ?? "professional",
    priorities: (biz?.growth_priorities as string[]) ?? [],
    challenge: (biz?.biggest_challenge as string) ?? null,
  };

  return (
    <OnboardingWizard
      initial={{
        userId,
        stepId,
        businessId: biz?.id ?? null,
        answers,
        theme: cust?.theme ?? null,
        connectStatus,
      }}
    />
  );
}
