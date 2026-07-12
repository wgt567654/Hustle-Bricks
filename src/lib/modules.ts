import type { ModulesSettings } from "@/lib/customization";

/* ============================================================================
   Module registry — every major surface of the OS is a module.
   The Shell renders whatever this resolves to, so nav order, visibility,
   and pinning are fully business-customizable (Settings → Customize →
   Modules). `home` is always present and always first.
   ============================================================================ */

export type ModuleItem = {
  href: string;
  label: string;
  icon: string;
  ownerOnly?: boolean;
};

export type Module = {
  id: string;
  label: string;
  icon: string;
  ownerOnly?: boolean;
  /** cannot be disabled */
  required?: boolean;
  items: ModuleItem[];
};

export const MODULE_REGISTRY: Module[] = [
  {
    id: "home",
    label: "Home",
    icon: "home",
    ownerOnly: true,
    required: true,
    items: [{ href: "/home", label: "Home", icon: "home" }],
  },
  {
    id: "jobs",
    label: "Jobs",
    icon: "work",
    items: [
      { href: "/jobs", label: "All Jobs", icon: "list_alt" },
      { href: "/calendar", label: "Calendar", icon: "calendar_month" },
      { href: "/bookings", label: "Bookings", icon: "book_online" },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    icon: "group",
    items: [
      { href: "/clients", label: "Clients", icon: "contacts" },
      { href: "/leads", label: "Leads", icon: "person_search" },
      { href: "/inbox", label: "Inbox", icon: "chat" },
      { href: "/plans", label: "Plans", icon: "autorenew" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: "trending_up",
    items: [
      { href: "/sales", label: "Pipeline", icon: "trending_up" },
      { href: "/quotes", label: "Quotes", icon: "request_quote" },
      { href: "/payments", label: "Payments", icon: "attach_money" },
      {
        href: "/services",
        label: "Services",
        icon: "home_repair_service",
        ownerOnly: true,
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    icon: "badge",
    ownerOnly: true,
    items: [
      { href: "/team", label: "Members", icon: "badge" },
      { href: "/messages", label: "Chat", icon: "forum" },
      { href: "/territories", label: "Territories", icon: "pin_drop" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "bar_chart",
    ownerOnly: true,
    items: [
      { href: "/analytics", label: "Analytics", icon: "leaderboard" },
      { href: "/reports/mileage", label: "Mileage", icon: "local_gas_station" },
      {
        href: "/reports/profitability",
        label: "Profitability",
        icon: "trending_up",
      },
      { href: "/reports/commission", label: "Commission", icon: "emoji_events" },
    ],
  },
  {
    id: "field",
    label: "Field",
    icon: "map",
    items: [
      { href: "/canvassing", label: "Map", icon: "map" },
      { href: "/heatmap", label: "Heat Map", icon: "whatshot", ownerOnly: true },
      { href: "/intel", label: "Intel", icon: "visibility", ownerOnly: true },
      {
        href: "/inventory",
        label: "Inventory",
        icon: "inventory_2",
        ownerOnly: true,
      },
    ],
  },
];

/**
 * Apply a business's module settings to the registry:
 * custom order → pinned float to front (after `home`) → disabled removed
 * (except required) → role filtering. Unknown ids are ignored; registry
 * modules missing from `order` are appended in registry order, so new
 * modules ship visible by default.
 */
export function resolveModules(
  settings: ModulesSettings | undefined,
  isOwner: boolean
): Module[] {
  const byId = new Map(MODULE_REGISTRY.map((m) => [m.id, m]));
  const order = settings?.order?.filter((id) => byId.has(id)) ?? [];
  const seen = new Set(order);
  const ordered = [
    ...order.map((id) => byId.get(id)!),
    ...MODULE_REGISTRY.filter((m) => !seen.has(m.id)),
  ];

  const pinned = new Set(settings?.pinned ?? []);
  const disabled = new Set(settings?.disabled ?? []);

  const sorted = [
    ...ordered.filter((m) => m.id === "home"),
    ...ordered.filter((m) => m.id !== "home" && pinned.has(m.id)),
    ...ordered.filter((m) => m.id !== "home" && !pinned.has(m.id)),
  ];

  return sorted.filter(
    (m) =>
      (m.required || !disabled.has(m.id)) &&
      (!m.ownerOnly || isOwner)
  );
}
