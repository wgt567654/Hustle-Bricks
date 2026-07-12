import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================================
   Custom fields — unlimited typed fields on clients, jobs, quotes, and leads.
   Definitions live in custom_fields; values in custom_field_values keyed by
   (field_id, entity_id). Never throws: everything degrades to empty lists
   until customization.sql is run.
   ============================================================================ */

export type FieldEntity = "client" | "job" | "quote" | "lead";

export type FieldType =
  | "text"
  | "number"
  | "checkbox"
  | "select"
  | "multiselect"
  | "phone"
  | "email"
  | "url"
  | "date"
  | "location"
  | "file";

export type CustomFieldDef = {
  id?: string;
  entity: FieldEntity;
  key: string;
  label: string;
  fieldType: FieldType;
  /** {"choices": string[]} for select/multiselect */
  options: { choices?: string[] };
  required: boolean;
  sortOrder: number;
};

export const FIELD_TYPE_META: Record<FieldType, { label: string; icon: string }> = {
  text: { label: "Text", icon: "notes" },
  number: { label: "Number", icon: "tag" },
  checkbox: { label: "Checkbox", icon: "check_box" },
  select: { label: "Dropdown", icon: "arrow_drop_down_circle" },
  multiselect: { label: "Multi-select", icon: "checklist" },
  phone: { label: "Phone", icon: "call" },
  email: { label: "Email", icon: "mail" },
  url: { label: "URL", icon: "link" },
  date: { label: "Date", icon: "event" },
  location: { label: "Location", icon: "location_on" },
  file: { label: "File", icon: "attach_file" },
};

export const FIELD_ENTITY_META: Record<FieldEntity, { label: string; examples: string }> = {
  client: { label: "Customers", examples: "Gate code, HOA, pets, parking notes" },
  job: { label: "Jobs", examples: "Water source, window count, pool access" },
  quote: { label: "Quotes", examples: "Roof pitch, stories, preferred date" },
  lead: { label: "Leads", examples: "Referral source, budget, urgency" },
};

export async function getCustomFields(
  supabase: SupabaseClient,
  businessId: string,
  entity?: FieldEntity
): Promise<CustomFieldDef[]> {
  try {
    let q = supabase
      .from("custom_fields")
      .select("id, entity, key, label, field_type, options, required, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true });
    if (entity) q = q.eq("entity", entity);
    const { data, error } = await q;
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id,
      entity: r.entity as FieldEntity,
      key: r.key,
      label: r.label,
      fieldType: (r.field_type as FieldType) ?? "text",
      options: (r.options as { choices?: string[] }) ?? {},
      required: !!r.required,
      sortOrder: r.sort_order ?? 0,
    }));
  } catch {
    return [];
  }
}

/** Values for one record, keyed by field key. */
export async function getCustomFieldValues(
  supabase: SupabaseClient,
  businessId: string,
  entityId: string
): Promise<Record<string, unknown>> {
  try {
    const { data, error } = await supabase
      .from("custom_field_values")
      .select("value, custom_fields(key)")
      .eq("business_id", businessId)
      .eq("entity_id", entityId);
    if (error || !data) return {};
    const out: Record<string, unknown> = {};
    for (const row of data) {
      const key = (row.custom_fields as unknown as { key: string } | null)?.key;
      if (key) out[key] = (row.value as { v?: unknown })?.v;
    }
    return out;
  } catch {
    return {};
  }
}
