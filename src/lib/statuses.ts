import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================================
   Custom statuses / stages / tags / priorities.

   Two customization tiers:
   - RELABEL/RECOLOR (system keys, is_system=true): job + quote statuses.
     Their stored values drive payments, crons, and automations, so the keys
     are fixed — but businesses control how they read and look.
   - FULL VOCABULARY (custom keys allowed): lead stages, client tags,
     priorities, labels. Businesses add/remove/reorder their own.
   ============================================================================ */

export type StatusEntity =
  | "lead"
  | "job"
  | "quote"
  | "client_tag"
  | "priority";

export type StatusDef = {
  entity: StatusEntity;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  /** system keys can be relabeled/recolored but not deleted */
  isSystem: boolean;
};

export const STATUS_ENTITY_META: Record<
  StatusEntity,
  { label: string; desc: string; allowCustom: boolean }
> = {
  lead: {
    label: "Lead Stages",
    desc: "Your sales pipeline, in your words. Add, rename, and reorder stages.",
    allowCustom: true,
  },
  job: {
    label: "Job Statuses",
    desc: "Rename and recolor. Keys are fixed — payments and automations depend on them.",
    allowCustom: false,
  },
  quote: {
    label: "Quote Statuses",
    desc: "Rename and recolor. Keys are fixed — follow-ups and conversions depend on them.",
    allowCustom: false,
  },
  client_tag: {
    label: "Customer Tags",
    desc: "Segment customers your way — add any tags you need.",
    allowCustom: true,
  },
  priority: {
    label: "Priority Levels",
    desc: "Define the urgency scale your team actually uses.",
    allowCustom: true,
  },
};

export const DEFAULT_STATUSES: StatusDef[] = [
  // Lead pipeline
  { entity: "lead", key: "new", label: "New", color: "#2E6A8E", sortOrder: 0, isSystem: true },
  { entity: "lead", key: "contacted", label: "Contacted", color: "#0EA5E9", sortOrder: 1, isSystem: true },
  { entity: "lead", key: "quoted", label: "Quoted", color: "#8B5CF6", sortOrder: 2, isSystem: true },
  { entity: "lead", key: "won", label: "Won", color: "#16A34A", sortOrder: 3, isSystem: true },
  { entity: "lead", key: "lost", label: "Lost", color: "#6B7280", sortOrder: 4, isSystem: true },
  // Jobs
  { entity: "job", key: "scheduled", label: "Scheduled", color: "#2E6A8E", sortOrder: 0, isSystem: true },
  { entity: "job", key: "in_progress", label: "In Progress", color: "#EA580C", sortOrder: 1, isSystem: true },
  { entity: "job", key: "completed", label: "Completed", color: "#16A34A", sortOrder: 2, isSystem: true },
  { entity: "job", key: "cancelled", label: "Cancelled", color: "#6B7280", sortOrder: 3, isSystem: true },
  // Quotes
  { entity: "quote", key: "draft", label: "Draft", color: "#6B7280", sortOrder: 0, isSystem: true },
  { entity: "quote", key: "sent", label: "Sent", color: "#2E6A8E", sortOrder: 1, isSystem: true },
  { entity: "quote", key: "accepted", label: "Accepted", color: "#16A34A", sortOrder: 2, isSystem: true },
  { entity: "quote", key: "declined", label: "Declined", color: "#DC2626", sortOrder: 3, isSystem: true },
  // Client tags
  { entity: "client_tag", key: "residential", label: "Residential", color: "#2E6A8E", sortOrder: 0, isSystem: true },
  { entity: "client_tag", key: "commercial", label: "Commercial", color: "#8B5CF6", sortOrder: 1, isSystem: true },
  { entity: "client_tag", key: "vip", label: "VIP", color: "#F59E0B", sortOrder: 2, isSystem: true },
  // Priorities
  { entity: "priority", key: "low", label: "Low", color: "#6B7280", sortOrder: 0, isSystem: true },
  { entity: "priority", key: "medium", label: "Medium", color: "#0EA5E9", sortOrder: 1, isSystem: true },
  { entity: "priority", key: "high", label: "High", color: "#EA580C", sortOrder: 2, isSystem: true },
  { entity: "priority", key: "urgent", label: "Urgent", color: "#DC2626", sortOrder: 3, isSystem: true },
];

/**
 * Defaults merged with a business's overrides/additions from custom_statuses.
 * Overrides match on (entity, key); additions append. Never throws — returns
 * defaults if the table doesn't exist yet.
 */
export async function getStatuses(
  supabase: SupabaseClient,
  businessId: string
): Promise<StatusDef[]> {
  try {
    const { data, error } = await supabase
      .from("custom_statuses")
      .select("entity, key, label, color, sort_order, is_system")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true });
    if (error || !data) return DEFAULT_STATUSES;

    const overrides = new Map(
      data.map((r) => [`${r.entity}:${r.key}`, r] as const)
    );
    const merged: StatusDef[] = DEFAULT_STATUSES.map((d) => {
      const o = overrides.get(`${d.entity}:${d.key}`);
      overrides.delete(`${d.entity}:${d.key}`);
      return o
        ? {
            ...d,
            label: o.label ?? d.label,
            color: o.color ?? d.color,
            sortOrder: o.sort_order ?? d.sortOrder,
          }
        : d;
    });
    for (const r of overrides.values()) {
      merged.push({
        entity: r.entity as StatusEntity,
        key: r.key,
        label: r.label,
        color: r.color,
        sortOrder: r.sort_order ?? 99,
        isSystem: false,
      });
    }
    return merged.sort((a, b) =>
      a.entity === b.entity
        ? a.sortOrder - b.sortOrder
        : a.entity.localeCompare(b.entity)
    );
  } catch {
    return DEFAULT_STATUSES;
  }
}

export function statusesFor(all: StatusDef[], entity: StatusEntity) {
  return all.filter((s) => s.entity === entity);
}
