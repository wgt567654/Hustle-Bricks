import type { SupabaseClient } from "@supabase/supabase-js";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { DEFAULT_THEME } from "@/lib/customization";
import { TEAM_SIZES, type StepId } from "@/lib/onboarding/config";

/* ============================================================================
   Per-step persistence. Every answer is written to its real home (profiles,
   businesses, scheduling_settings, business_customization, services, …) so
   the Settings pages reflect onboarding immediately.

   Migration tolerance: writes that depend on an owner-run .sql file are
   isolated and report the missing file instead of failing the step, matching
   the customization.sql convention used across the app.
   ============================================================================ */

export type OnboardingAnswers = {
  firstName: string;
  lastName: string;
  phone: string;
  businessName: string;
  country: string;
  /** industry template id, "custom", or null (skipped) */
  industry: string | null;
  /** display label saved to businesses.business_type */
  industryLabel: string;
  services: { name: string; price: number }[];
  teamSize: string | null;
  stage: string | null;
  jobValue: string | null;
  goal: number | null;
  taxRate: number | null;
  paymentMethods: string[];
  venmoUsername: string;
  cashappTag: string;
  checkPayableTo: string;
  workDays: number[];
  dayFrom: string;
  dayUntil: string;
  city: string;
  serviceAreas: string[];
  automations: Record<string, boolean>;
  accentH: number;
  accentC: number;
  tone: string;
  priorities: string[];
  challenge: string | null;
};

export type SaveResult = {
  error?: string;
  /** owner-run .sql files that would let this step persist fully */
  missingSql?: string[];
  businessId?: string;
};

type PgError = { code?: string; message?: string } | null;

const isMissingColumn = (e: PgError) =>
  !!e &&
  (e.code === "42703" ||
    e.code === "PGRST204" ||
    /column .* (does not exist|schema cache)/i.test(e.message ?? ""));

const isMissingTable = (e: PgError) =>
  !!e &&
  (e.code === "42P01" ||
    e.code === "PGRST205" ||
    /schema cache/i.test(e.message ?? ""));

/** Update businesses with columns added by onboarding_v3.sql. */
async function patchV3(
  supabase: SupabaseClient,
  businessId: string,
  patch: Record<string, unknown>
): Promise<SaveResult> {
  const { error } = await supabase
    .from("businesses")
    .update(patch)
    .eq("id", businessId);
  if (!error) return {};
  if (isMissingColumn(error)) return { missingSql: ["onboarding_v3.sql"] };
  return { error: error.message };
}

/** Update businesses with columns from other feature migrations. */
async function patchTolerant(
  supabase: SupabaseClient,
  businessId: string,
  patch: Record<string, unknown>,
  sqlFile: string
): Promise<SaveResult> {
  const { error } = await supabase
    .from("businesses")
    .update(patch)
    .eq("id", businessId);
  if (!error) return {};
  if (isMissingColumn(error)) return { missingSql: [sqlFile] };
  return { error: error.message };
}

function mergeResults(...results: SaveResult[]): SaveResult {
  const out: SaveResult = {};
  const sql = new Set<string>();
  for (const r of results) {
    if (r.error && !out.error) out.error = r.error;
    if (r.businessId) out.businessId = r.businessId;
    r.missingSql?.forEach((f) => sql.add(f));
  }
  if (sql.size) out.missingSql = [...sql];
  return out;
}

/** Best-effort resume pointer; silent when the column doesn't exist yet. */
export async function saveProgress(
  supabase: SupabaseClient,
  businessId: string,
  stepId: StepId
): Promise<void> {
  await supabase
    .from("businesses")
    .update({ onboarding_step: stepId })
    .eq("id", businessId);
}

/** Stamped when the user reaches the plan step — setup answers are all in. */
export async function stampCompleted(
  supabase: SupabaseClient,
  businessId: string
): Promise<SaveResult> {
  return patchV3(supabase, businessId, {
    onboarding_step: "plan",
    onboarding_completed_at: new Date().toISOString(),
  });
}

async function applyIndustryTemplate(
  supabase: SupabaseClient,
  businessId: string,
  templateId: string
): Promise<SaveResult> {
  const t = INDUSTRY_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return {};

  const theme = { ...DEFAULT_THEME, accentH: t.accentH, accentC: t.accentC };
  const { error } = await supabase.from("business_customization").upsert(
    {
      business_id: businessId,
      theme,
      quick_actions: t.quickActions,
      industry_template: t.id,
    },
    { onConflict: "business_id" }
  );
  if (error) {
    if (isMissingTable(error)) return { missingSql: ["customization.sql"] };
    return { error: error.message };
  }

  if (t.extraLeadStages.length) {
    await supabase.from("custom_statuses").upsert(
      t.extraLeadStages.map((s, i) => ({
        business_id: businessId,
        entity: "lead",
        key: s.key,
        label: s.label,
        color: s.color,
        sort_order: 10 + i,
        is_system: false,
      })),
      { onConflict: "business_id,entity,key" }
    );
  }
  if (t.fields.length) {
    await supabase.from("custom_fields").upsert(
      t.fields.map((f, i) => ({
        business_id: businessId,
        entity: f.entity,
        key: f.key,
        label: f.label,
        field_type: f.fieldType,
        options: f.options ?? {},
        required: false,
        sort_order: i,
      })),
      { onConflict: "business_id,entity,key" }
    );
  }
  return {};
}

export async function saveStep(
  supabase: SupabaseClient,
  stepId: StepId,
  a: OnboardingAnswers,
  ctx: { userId: string; businessId: string | null; currency: string }
): Promise<SaveResult> {
  const bid = ctx.businessId;

  switch (stepId) {
    case "welcome":
      return {};

    case "name": {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: a.firstName.trim(),
          last_name: a.lastName.trim(),
          full_name: `${a.firstName.trim()} ${a.lastName.trim()}`,
          phone: a.phone.trim() || null,
        })
        .eq("id", ctx.userId);
      return error ? { error: error.message } : {};
    }

    case "business": {
      if (bid) {
        const { error } = await supabase
          .from("businesses")
          .update({
            name: a.businessName.trim(),
            country: a.country,
            currency: ctx.currency,
          })
          .eq("id", bid);
        return error ? { error: error.message } : { businessId: bid };
      }
      const { data, error } = await supabase
        .from("businesses")
        .insert({
          owner_id: ctx.userId,
          name: a.businessName.trim(),
          country: a.country,
          currency: ctx.currency,
        })
        .select("id")
        .single();
      if (error || !data)
        return { error: error?.message ?? "Failed to create business." };
      return { businessId: data.id };
    }

    case "industry": {
      if (!bid) return {};
      const results: SaveResult[] = [];
      if (a.industryLabel) {
        results.push(
          await patchTolerant(
            supabase,
            bid,
            { business_type: a.industryLabel },
            "add_business_type.sql"
          )
        );
      }
      if (a.industry && a.industry !== "custom") {
        results.push(await applyIndustryTemplate(supabase, bid, a.industry));
      }
      return mergeResults(...results);
    }

    case "services": {
      if (!bid || a.services.length === 0) return {};
      // additive: never duplicate a service the business already has
      const { data: existing } = await supabase
        .from("services")
        .select("name")
        .eq("business_id", bid);
      const have = new Set(
        (existing ?? []).map((s: { name: string }) => s.name.toLowerCase())
      );
      const rows = a.services
        .filter((s) => s.name.trim() && !have.has(s.name.trim().toLowerCase()))
        .map((s) => ({
          business_id: bid,
          name: s.name.trim(),
          price: s.price,
          is_active: true,
        }));
      if (!rows.length) return {};
      const { error } = await supabase.from("services").insert(rows);
      return error ? { error: error.message } : {};
    }

    case "team": {
      if (!bid || !a.teamSize) return {};
      const results = [await patchV3(supabase, bid, { team_size: a.teamSize })];
      const crewSize = TEAM_SIZES.find((t) => t.key === a.teamSize)?.crewSize;
      if (crewSize) {
        const { error } = await supabase
          .from("business_crew_settings")
          .upsert(
            { business_id: bid, crew_size: crewSize },
            { onConflict: "business_id" }
          );
        if (error && isMissingTable(error))
          results.push({ missingSql: ["employee_availability.sql"] });
      }
      return mergeResults(...results);
    }

    case "stage":
      if (!bid || !a.stage) return {};
      return patchV3(supabase, bid, { business_stage: a.stage });

    case "jobValue":
      if (!bid || !a.jobValue) return {};
      return patchV3(supabase, bid, { avg_job_value_range: a.jobValue });

    case "goal":
      if (!bid || !a.goal) return {};
      return patchV3(supabase, bid, { monthly_revenue_goal: a.goal });

    case "money": {
      if (!bid) return {};
      const base: Record<string, unknown> = {
        venmo_username: a.paymentMethods.includes("venmo")
          ? a.venmoUsername.trim() || null
          : null,
        cashapp_tag: a.paymentMethods.includes("cashapp")
          ? a.cashappTag.trim() || null
          : null,
        check_payable_to: a.paymentMethods.includes("check")
          ? a.checkPayableTo.trim() || null
          : null,
      };
      if (a.taxRate !== null) base.tax_rate = a.taxRate;
      const { error } = await supabase
        .from("businesses")
        .update(base)
        .eq("id", bid);
      const results: SaveResult[] = [error ? { error: error.message } : {}];
      results.push(
        await patchV3(supabase, bid, { payment_methods: a.paymentMethods })
      );
      return mergeResults(...results);
    }

    case "hours": {
      if (!bid || a.workDays.length === 0) return {};
      const unavailable = [0, 1, 2, 3, 4, 5, 6].filter(
        (d) => !a.workDays.includes(d)
      );
      const dayHours: Record<string, { from: string; until: string }> = {};
      for (const d of a.workDays)
        dayHours[String(d)] = { from: a.dayFrom, until: a.dayUntil };
      const { error } = await supabase.from("scheduling_settings").upsert(
        {
          business_id: bid,
          unavailable_days: unavailable,
          day_hours: dayHours,
        },
        { onConflict: "business_id" }
      );
      if (!error) return {};
      if (isMissingTable(error))
        return { missingSql: ["booking_scheduling.sql"] };
      return { error: error.message };
    }

    case "area": {
      if (!bid || (!a.city.trim() && a.serviceAreas.length === 0)) return {};
      return patchTolerant(
        supabase,
        bid,
        {
          city: a.city.trim() || null,
          service_areas: a.serviceAreas,
        },
        "messaging_and_service_areas.sql"
      );
    }

    case "automations":
      if (!bid) return {};
      return patchTolerant(
        supabase,
        bid,
        { ...a.automations },
        "RUN_ME_launch_migrations.sql"
      );

    case "workspace": {
      if (!bid) return {};
      const theme = { ...DEFAULT_THEME, accentH: a.accentH, accentC: a.accentC };
      const { error } = await supabase
        .from("business_customization")
        .upsert({ business_id: bid, theme }, { onConflict: "business_id" });
      if (!error) return {};
      if (isMissingTable(error)) return { missingSql: ["customization.sql"] };
      return { error: error.message };
    }

    case "ai": {
      if (!bid) return {};
      const results: SaveResult[] = [];
      const { error } = await supabase.from("business_customization").upsert(
        {
          business_id: bid,
          ai_personality: { tone: a.tone, instructions: "" },
        },
        { onConflict: "business_id" }
      );
      if (error) {
        results.push(
          isMissingTable(error)
            ? { missingSql: ["customization.sql"] }
            : { error: error.message }
        );
      }
      results.push(
        await patchV3(supabase, bid, {
          growth_priorities: a.priorities,
          biggest_challenge: a.challenge,
        })
      );
      return mergeResults(...results);
    }

    case "payments":
      // Stripe Connect status is written by the express route + webhook
      return {};

    case "plan":
      return {};
  }
}
