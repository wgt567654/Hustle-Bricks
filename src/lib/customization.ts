import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================================
   Customization framework — types, defaults, and access helpers.

   Backed by supabase/customization.sql. Every reader must tolerate the
   tables not existing yet (migration is an owner action), so all fetchers
   swallow errors and fall back to defaults.
   ============================================================================ */

export type ThemeSettings = {
  /** OKLCH hue for the brand accent — re-skins the whole app */
  accentH: number;
  /** OKLCH chroma for the brand accent (0 = neutral gray) */
  accentC: number;
  /** 0.5 sharp · 1 default · 1.5 soft */
  radiusScale: number;
  /** 0.875 compact · 1 comfortable */
  density: number;
  /** frosted glass surfaces on/off */
  glass: boolean;
};

export type ModulesSettings = {
  /** module ids in display order; unknown ids ignored, missing ids appended */
  order: string[];
  /** module ids hidden from nav (features stay reachable by URL) */
  disabled: string[];
  /** module ids pinned to the top of the sidebar */
  pinned: string[];
};

export type AIPersonality = {
  tone:
    | "professional"
    | "friendly"
    | "luxury"
    | "minimal"
    | "technical"
    | "funny"
    | "formal";
  /** permanent instructions the assistant always follows */
  instructions: string;
};

export type EmailBranding = {
  accentColor: string;
  headerText: string;
  footerText: string;
  signature: string;
  socialLinks: { label: string; url: string }[];
  disclaimer: string;
};

export type CustomizationDoc = {
  theme: ThemeSettings;
  modules: ModulesSettings;
  aiPersonality: AIPersonality;
  quickActions: string[];
  emailBranding: EmailBranding;
  industryTemplate: string | null;
};

export const DEFAULT_THEME: ThemeSettings = {
  accentH: 229,
  accentC: 0.082,
  radiusScale: 1,
  density: 1,
  glass: true,
};

export const DEFAULT_MODULES: ModulesSettings = {
  order: [],
  disabled: [],
  pinned: [],
};

export const DEFAULT_AI_PERSONALITY: AIPersonality = {
  tone: "professional",
  instructions: "",
};

export const DEFAULT_EMAIL_BRANDING: EmailBranding = {
  accentColor: "#2E6A8E",
  headerText: "",
  footerText: "",
  signature: "",
  socialLinks: [],
  disclaimer: "",
};

export const DEFAULT_CUSTOMIZATION: CustomizationDoc = {
  theme: DEFAULT_THEME,
  modules: DEFAULT_MODULES,
  aiPersonality: DEFAULT_AI_PERSONALITY,
  quickActions: ["new_job", "create_quote", "add_client", "collect_payment"],
  emailBranding: DEFAULT_EMAIL_BRANDING,
  industryTemplate: null,
};

/** Named accent presets shown in Appearance settings. */
export const ACCENT_PRESETS: { name: string; h: number; c: number }[] = [
  { name: "Steel", h: 229, c: 0.082 },
  { name: "Ocean", h: 245, c: 0.11 },
  { name: "Forest", h: 155, c: 0.09 },
  { name: "Emerald", h: 170, c: 0.1 },
  { name: "Violet", h: 293, c: 0.12 },
  { name: "Plum", h: 330, c: 0.1 },
  { name: "Copper", h: 45, c: 0.11 },
  { name: "Amber", h: 70, c: 0.12 },
  { name: "Crimson", h: 20, c: 0.13 },
  { name: "Graphite", h: 229, c: 0.015 },
];

const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;

export function normalizeTheme(raw: unknown): ThemeSettings {
  const t = (raw ?? {}) as Partial<ThemeSettings>;
  return {
    accentH: clamp(Number(t.accentH ?? DEFAULT_THEME.accentH), 0, 360),
    accentC: clamp(Number(t.accentC ?? DEFAULT_THEME.accentC), 0, 0.2),
    radiusScale: clamp(
      Number(t.radiusScale ?? DEFAULT_THEME.radiusScale),
      0.25,
      2
    ),
    density: clamp(Number(t.density ?? DEFAULT_THEME.density), 0.8, 1.15),
    glass: t.glass !== false,
  };
}

export function normalizeCustomization(row: unknown): CustomizationDoc {
  const r = (row ?? {}) as Record<string, unknown>;
  const modules = (r.modules ?? {}) as Partial<ModulesSettings>;
  const ai = (r.ai_personality ?? {}) as Partial<AIPersonality>;
  const branding = (r.email_branding ?? {}) as Partial<EmailBranding>;
  return {
    theme: normalizeTheme(r.theme),
    modules: {
      order: Array.isArray(modules.order) ? (modules.order as string[]) : [],
      disabled: Array.isArray(modules.disabled)
        ? (modules.disabled as string[])
        : [],
      pinned: Array.isArray(modules.pinned) ? (modules.pinned as string[]) : [],
    },
    aiPersonality: {
      tone: (ai.tone as AIPersonality["tone"]) ?? "professional",
      instructions:
        typeof ai.instructions === "string" ? ai.instructions : "",
    },
    quickActions: Array.isArray(r.quick_actions)
      ? (r.quick_actions as string[])
      : DEFAULT_CUSTOMIZATION.quickActions,
    emailBranding: { ...DEFAULT_EMAIL_BRANDING, ...branding },
    industryTemplate:
      typeof r.industry_template === "string" ? r.industry_template : null,
  };
}

/**
 * Fetch a business's customization document. Never throws: returns defaults
 * when the row or the table doesn't exist yet.
 */
export async function getCustomization(
  supabase: SupabaseClient,
  businessId: string
): Promise<CustomizationDoc> {
  try {
    const { data, error } = await supabase
      .from("business_customization")
      .select(
        "theme, modules, ai_personality, quick_actions, email_branding, industry_template"
      )
      .eq("business_id", businessId)
      .maybeSingle();
    if (error || !data) return DEFAULT_CUSTOMIZATION;
    return normalizeCustomization(data);
  } catch {
    return DEFAULT_CUSTOMIZATION;
  }
}

/** CSS custom-property block for a theme — used by <ThemeStyle> (server) and
 *  live preview (client). */
export function themeToCssVars(theme: ThemeSettings): string {
  return [
    `--accent-h: ${theme.accentH};`,
    `--accent-c: ${theme.accentC};`,
    `--radius-scale: ${theme.radiusScale};`,
    `--density: ${theme.density};`,
  ].join(" ");
}

/** Client-side live preview: mutate the running document. */
export function applyThemeToDocument(theme: ThemeSettings) {
  const el = document.documentElement;
  el.style.setProperty("--accent-h", String(theme.accentH));
  el.style.setProperty("--accent-c", String(theme.accentC));
  el.style.setProperty("--radius-scale", String(theme.radiusScale));
  el.style.setProperty("--density", String(theme.density));
  el.setAttribute("data-glass", theme.glass ? "on" : "off");
}
