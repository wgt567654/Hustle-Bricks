"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import {
  FIELD_ENTITY_META,
  FIELD_TYPE_META,
  type CustomFieldDef,
  type FieldEntity,
  type FieldType,
} from "@/lib/custom-fields";

const ENTITIES: FieldEntity[] = ["client", "job", "quote", "lead"];
const TYPES = Object.keys(FIELD_TYPE_META) as FieldType[];

function slugify(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export default function FieldsClient({
  businessId,
  initialFields,
}: {
  businessId: string;
  initialFields: CustomFieldDef[];
}) {
  const [entity, setEntity] = useState<FieldEntity>("client");
  const [fields, setFields] = useState<CustomFieldDef[]>(initialFields);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const list = useMemo(
    () => fields.filter((f) => f.entity === entity),
    [fields, entity]
  );

  function patch(key: string, p: Partial<CustomFieldDef>) {
    setFields((all) =>
      all.map((f) => (f.entity === entity && f.key === key ? { ...f, ...p } : f))
    );
    setDirty(true);
  }

  function addField() {
    const label = newLabel.trim();
    if (!label) return;
    const key = slugify(label);
    if (!key || list.some((f) => f.key === key)) {
      toast.error("A field with that name already exists");
      return;
    }
    setFields((all) => [
      ...all,
      {
        entity,
        key,
        label,
        fieldType: newType,
        options: {},
        required: false,
        sortOrder: list.length,
      },
    ]);
    setNewLabel("");
    setNewType("text");
    setDirty(true);
  }

  function remove(key: string) {
    const f = list.find((x) => x.key === key);
    if (f?.id) setRemovedIds((r) => [...r, f.id!]);
    setFields((all) => all.filter((x) => !(x.entity === entity && x.key === key)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();

    const rows = fields.map((f, i) => ({
      business_id: businessId,
      entity: f.entity,
      key: f.key,
      label: f.label,
      field_type: f.fieldType,
      options: f.options,
      required: f.required,
      sort_order: i,
    }));

    const { error } = await supabase
      .from("custom_fields")
      .upsert(rows, { onConflict: "business_id,entity,key" });

    if (!error && removedIds.length > 0) {
      await supabase.from("custom_fields").delete().in("id", removedIds);
    }

    setSaving(false);
    if (error) {
      const missingTable =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("schema cache");
      toast.error(
        missingTable
          ? "Run customization.sql in Supabase to enable custom fields"
          : "Couldn't save fields"
      );
      return;
    }
    setRemovedIds([]);
    setDirty(false);
    toast.success("Custom fields saved");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 pb-28">
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings/customize"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Customize Studio
        </Link>
        <h1 className="text-2xl">Custom Fields</h1>
        <p className="text-sm text-muted-foreground">
          Track what matters to your business — on any record, with the right
          input type.
        </p>
      </div>

      {/* Entity tabs */}
      <div className="reveal flex gap-1.5 overflow-x-auto scrollbar-none" style={{ "--reveal-i": 1 } as React.CSSProperties}>
        {ENTITIES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEntity(e)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              entity === e
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {FIELD_ENTITY_META[e].label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium">
              No custom fields on {FIELD_ENTITY_META[entity].label.toLowerCase()} yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try: {FIELD_ENTITY_META[entity].examples}
            </p>
          </div>
        )}

        {list.map((f) => (
          <div
            key={f.key}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3 py-2.5"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined icon-sky flex size-8 shrink-0 items-center justify-center rounded-lg text-[17px]">
                {FIELD_TYPE_META[f.fieldType].icon}
              </span>
              <input
                type="text"
                value={f.label}
                onChange={(e) => patch(f.key, { label: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium focus:border-border focus:bg-background focus:outline-none"
                aria-label={`${f.label} name`}
              />
              <select
                value={f.fieldType}
                onChange={(e) => patch(f.key, { fieldType: e.target.value as FieldType })}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                aria-label={`${f.label} type`}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_META[t].label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => patch(f.key, { required: e.target.checked })}
                  className="size-3.5 accent-[var(--primary)]"
                />
                Required
              </label>
              <button
                type="button"
                aria-label={`Delete ${f.label}`}
                onClick={() => remove(f.key)}
                className="press flex size-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-destructive"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>

            {(f.fieldType === "select" || f.fieldType === "multiselect") && (
              <input
                type="text"
                value={(f.options.choices ?? []).join(", ")}
                onChange={(e) =>
                  patch(f.key, {
                    options: {
                      choices: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                placeholder="Options, separated by commas"
                className="ml-11 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              />
            )}
          </div>
        ))}

        {/* Add new */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addField();
          }}
          className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2"
        >
          <span className="material-symbols-outlined text-[18px] text-muted-foreground">add</span>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Field name, e.g. Gate Code"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm focus:outline-none"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as FieldType)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            aria-label="New field type"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_META[t].label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newLabel.trim()}
            className="press rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </div>

      {dirty && (
        <div className="glass-sheet fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-4 py-3 animate-in-down">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="press rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save fields"}
          </button>
        </div>
      )}
    </div>
  );
}
