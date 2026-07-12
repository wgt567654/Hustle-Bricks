/* ============================================================================
   Onboarding config — the single source of truth for the guided setup flow.

   Everything here is pure data. The wizard renders whatever this registry
   declares, so adding a screen = add a StepDef + a component; reordering =
   reorder the array. No wizard logic changes required.
   ============================================================================ */

export type SectionId =
  | "you"
  | "business"
  | "money"
  | "operations"
  | "personalize"
  | "plan";

export const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: "you", label: "You", icon: "waving_hand" },
  { id: "business", label: "Your business", icon: "storefront" },
  { id: "money", label: "Money", icon: "payments" },
  { id: "operations", label: "Operations", icon: "calendar_month" },
  { id: "personalize", label: "Personalize", icon: "palette" },
  { id: "plan", label: "Plan", icon: "workspace_premium" },
];

export type StepId =
  | "welcome"
  | "name"
  | "business"
  | "industry"
  | "services"
  | "team"
  | "stage"
  | "jobValue"
  | "goal"
  | "money"
  | "payments"
  | "hours"
  | "area"
  | "automations"
  | "workspace"
  | "ai"
  | "plan";

export type StepDef = {
  id: StepId;
  section: SectionId;
  /** optional steps render a "Skip for now" action */
  optional: boolean;
};

export const STEPS: StepDef[] = [
  { id: "welcome", section: "you", optional: false },
  { id: "name", section: "you", optional: false },
  { id: "business", section: "business", optional: false },
  { id: "industry", section: "business", optional: true },
  { id: "services", section: "business", optional: true },
  { id: "team", section: "business", optional: true },
  { id: "stage", section: "business", optional: true },
  { id: "jobValue", section: "money", optional: true },
  { id: "goal", section: "money", optional: true },
  { id: "money", section: "money", optional: true },
  { id: "payments", section: "money", optional: true },
  { id: "hours", section: "operations", optional: true },
  { id: "area", section: "operations", optional: true },
  { id: "automations", section: "operations", optional: true },
  { id: "workspace", section: "personalize", optional: true },
  { id: "ai", section: "personalize", optional: true },
  { id: "plan", section: "plan", optional: false },
];

export const stepIndex = (id: StepId) => STEPS.findIndex((s) => s.id === id);

export const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸", symbol: "$" },
  { code: "CA", name: "Canada", currency: "CAD", flag: "🇨🇦", symbol: "C$" },
  { code: "AU", name: "Australia", currency: "AUD", flag: "🇦🇺", symbol: "A$" },
] as const;

/* ── Segmented choice options ─────────────────────────────────────────────── */

export type ChoiceOption = {
  key: string;
  label: string;
  hint?: string;
  icon: string;
};

/** crewSize seeds business_crew_settings for booking capacity */
export const TEAM_SIZES: (ChoiceOption & { crewSize: number })[] = [
  { key: "solo", label: "Just me", hint: "Solo operator", icon: "person", crewSize: 1 },
  { key: "2_5", label: "2–5 people", hint: "Small crew", icon: "group", crewSize: 3 },
  { key: "6_15", label: "6–15 people", hint: "Multiple crews", icon: "groups", crewSize: 8 },
  { key: "16_plus", label: "16+ people", hint: "Full operation", icon: "diversity_3", crewSize: 16 },
];

export const BUSINESS_STAGES: ChoiceOption[] = [
  { key: "new", label: "Just getting started", hint: "Under a year in", icon: "rocket_launch" },
  { key: "growing", label: "Finding momentum", hint: "1–3 years in", icon: "trending_up" },
  { key: "established", label: "Established", hint: "3–10 years in", icon: "storefront" },
  { key: "veteran", label: "Veteran", hint: "10+ years in", icon: "military_tech" },
];

export const JOB_VALUE_RANGES: ChoiceOption[] = [
  { key: "under_150", label: "Under $150", hint: "Quick visits", icon: "bolt" },
  { key: "150_500", label: "$150 – $500", hint: "Standard jobs", icon: "home_repair_service" },
  { key: "500_2000", label: "$500 – $2,000", hint: "Bigger projects", icon: "construction" },
  { key: "over_2000", label: "$2,000+", hint: "Major work", icon: "apartment" },
];

/* ── Goals ────────────────────────────────────────────────────────────────── */

export const GOAL_MIN = 1000;
export const GOAL_MAX = 100000;
export const GOAL_STEP = 500;
export const GOAL_PRESETS = [5000, 10000, 20000, 40000];
export const GOAL_DEFAULT = 10000;

/* ── Money setup ──────────────────────────────────────────────────────────── */

export const TAX_RATE_CHIPS = [0, 5, 6.5, 7, 8, 10];

export const PAYMENT_METHOD_OPTIONS: ChoiceOption[] = [
  { key: "card", label: "Card", hint: "via Stripe", icon: "credit_card" },
  { key: "cash", label: "Cash", icon: "payments" },
  { key: "check", label: "Check", icon: "money" },
  { key: "venmo", label: "Venmo", icon: "smartphone" },
  { key: "cashapp", label: "Cash App", icon: "attach_money" },
];

/* ── Operations ───────────────────────────────────────────────────────────── */

export const WEEKDAYS = [
  { day: 1, short: "M", label: "Monday" },
  { day: 2, short: "T", label: "Tuesday" },
  { day: 3, short: "W", label: "Wednesday" },
  { day: 4, short: "T", label: "Thursday" },
  { day: 5, short: "F", label: "Friday" },
  { day: 6, short: "S", label: "Saturday" },
  { day: 0, short: "S", label: "Sunday" },
];

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];
export const DEFAULT_DAY_FROM = "08:00";
export const DEFAULT_DAY_UNTIL = "17:00";

/** businesses.* boolean columns behind each automation, with launch defaults */
export const AUTOMATION_OPTIONS: {
  key: string;
  label: string;
  description: string;
  icon: string;
  defaultOn: boolean;
}[] = [
  {
    key: "sms_reminders_enabled",
    label: "Job reminders",
    description: "Text clients the day before a visit so nobody forgets.",
    icon: "sms",
    defaultOn: true,
  },
  {
    key: "payment_reminders_enabled",
    label: "Payment reminders",
    description: "Automatically nudge unpaid invoices until they're settled.",
    icon: "request_quote",
    defaultOn: true,
  },
  {
    key: "auto_invoice_enabled",
    label: "Auto-invoice",
    description: "Send the invoice the moment a job is marked complete.",
    icon: "receipt_long",
    defaultOn: true,
  },
  {
    key: "review_requests_enabled",
    label: "Review requests",
    description: "Ask happy customers for a review after each completed job.",
    icon: "star",
    defaultOn: false,
  },
  {
    key: "morning_briefing_enabled",
    label: "Morning briefing",
    description: "A daily email with today's schedule and money on the table.",
    icon: "wb_sunny",
    defaultOn: false,
  },
];

/* ── AI personalization ───────────────────────────────────────────────────── */

export const AI_TONES: ChoiceOption[] = [
  { key: "professional", label: "Professional", hint: "Clear and businesslike", icon: "work" },
  { key: "friendly", label: "Friendly", hint: "Warm and personal", icon: "sentiment_satisfied" },
  { key: "minimal", label: "Minimal", hint: "Short and to the point", icon: "remove" },
  { key: "luxury", label: "Luxury", hint: "White-glove polish", icon: "diamond" },
  { key: "technical", label: "Technical", hint: "Detail-first", icon: "settings" },
  { key: "funny", label: "Funny", hint: "A little personality", icon: "mood" },
];

export const GROWTH_PRIORITIES: ChoiceOption[] = [
  { key: "win_leads", label: "Win more leads", icon: "person_add" },
  { key: "get_paid", label: "Get paid faster", icon: "paid" },
  { key: "save_time", label: "Save time on admin", icon: "timer" },
  { key: "grow_team", label: "Grow my team", icon: "group_add" },
  { key: "repeat_customers", label: "Repeat customers", icon: "autorenew" },
  { key: "tighter_schedule", label: "A tighter schedule", icon: "event_available" },
];

export const BIGGEST_CHALLENGES: ChoiceOption[] = [
  { key: "leads", label: "Not enough leads", icon: "search_off" },
  { key: "collections", label: "Chasing payments", icon: "hourglass_top" },
  { key: "scheduling", label: "Scheduling chaos", icon: "calendar_today" },
  { key: "solo_overload", label: "Doing everything myself", icon: "person_alert" },
  { key: "retention", label: "One-and-done customers", icon: "logout" },
  { key: "pricing", label: "Pricing jobs right", icon: "sell" },
];

/* ── Service catalog seeds, per industry template ─────────────────────────── */

export type ServiceSuggestion = { name: string; price: number };

export const SERVICE_SUGGESTIONS: Record<string, ServiceSuggestion[]> = {
  window_cleaning: [
    { name: "Exterior Window Cleaning", price: 149 },
    { name: "Interior + Exterior Windows", price: 249 },
    { name: "Screen Cleaning", price: 49 },
    { name: "Gutter Cleaning", price: 179 },
    { name: "Hard Water Stain Removal", price: 99 },
  ],
  pressure_washing: [
    { name: "Driveway Cleaning", price: 199 },
    { name: "House Wash", price: 299 },
    { name: "Deck / Patio Cleaning", price: 249 },
    { name: "Roof Soft Wash", price: 399 },
    { name: "Fence Cleaning", price: 179 },
  ],
  roof_cleaning: [
    { name: "Roof Soft Wash", price: 399 },
    { name: "Moss Treatment", price: 249 },
    { name: "Gutter Cleaning", price: 179 },
    { name: "Roof Inspection", price: 99 },
  ],
  lawn_care: [
    { name: "Lawn Mowing", price: 59 },
    { name: "Fertilization", price: 89 },
    { name: "Aeration", price: 129 },
    { name: "Leaf Cleanup", price: 149 },
    { name: "Hedge Trimming", price: 99 },
  ],
  house_cleaning: [
    { name: "Standard Clean", price: 139 },
    { name: "Deep Clean", price: 259 },
    { name: "Move-In / Move-Out Clean", price: 329 },
    { name: "Recurring Clean", price: 119 },
  ],
  hvac: [
    { name: "AC Tune-Up", price: 129 },
    { name: "Furnace Tune-Up", price: 129 },
    { name: "Diagnostic Visit", price: 89 },
    { name: "Filter Replacement", price: 49 },
    { name: "Duct Cleaning", price: 349 },
  ],
  electrical: [
    { name: "Service Call", price: 99 },
    { name: "Outlet / Switch Install", price: 149 },
    { name: "Lighting Install", price: 249 },
    { name: "EV Charger Install", price: 899 },
    { name: "Panel Upgrade", price: 1800 },
  ],
  painting: [
    { name: "Interior Room", price: 449 },
    { name: "Cabinet Painting", price: 1200 },
    { name: "Deck Staining", price: 649 },
    { name: "Exterior Repaint", price: 2900 },
  ],
  commercial_cleaning: [
    { name: "Office Cleaning", price: 249 },
    { name: "Floor Care", price: 399 },
    { name: "Window Cleaning", price: 199 },
    { name: "Restroom Sanitation", price: 149 },
  ],
  detailing: [
    { name: "Express Detail", price: 89 },
    { name: "Interior Detail", price: 149 },
    { name: "Full Detail", price: 199 },
    { name: "Ceramic Coating", price: 699 },
  ],
  /** fallback when the trade isn't one of the templates */
  default: [
    { name: "Service Call", price: 99 },
    { name: "Standard Service", price: 149 },
    { name: "Premium Service", price: 299 },
  ],
};

export function serviceSuggestionsFor(industryId: string | null): ServiceSuggestion[] {
  return SERVICE_SUGGESTIONS[industryId ?? "default"] ?? SERVICE_SUGGESTIONS.default;
}
