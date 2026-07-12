"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import {
  STATUS_ENTITY_META,
  statusesFor,
  type StatusDef,
  type StatusEntity,
} from "@/lib/statuses";

const ENTITY_ORDER: StatusEntity[] = [
  "lead",
  "job",
  "quote",
  "client_tag",
  "priority",
];

function slugify(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export default function StatusesClient({
  businessId,
  initialStatuses,
}: {
  businessId: string;
  initialStatuses: StatusDef[];
}) {
  const [entity, setEntity] = useState<StatusEntity>("lead");
  const [statuses, setStatuses] = useState<StatusDef[]>(initialStatuses);
  const [removedKeys, setRemovedKeys] = useState<{ entity: string; key: string }[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const meta = STATUS_ENTITY_META[entity];
  const list = useMemo(() => statusesFor(statuses, entity), [statuses, entity]);

  function patch(key: string, p: Partial<StatusDef>) {
    setStatuses((all) =>
      all.map((s) => (s.entity === entity && s.key === key ? { ...s, ...p } : s))
    );
    setDirty(true);
  }

  function move(key: string, dir: -1 | 1) {
    const items = statusesFor(statuses, entity);
    const i = items.findIndex((s) => s.key === key);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const reordered = [...items];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    const withOrder = reordered.map((s, idx) => ({ ...s, sortOrder: idx }));
    setStatuses((all) => [
      ...all.filter((s) => s.entity !== entity),
      ...withOrder,
    ]);
    setDirty(true);
  }

  function addStatus() {
    const label = newLabel.trim();
    if (!label) return;
    const key = slugify(label);
    if (!key) return;
    if (list.some((s) => s.key === key)) {
      toast.error("A status with that name already exists");
      return;
    }
    setStatuses((all) => [
      ...all,
      {
        entity,
        key,
        label,
        color: "#2E6A8E",
        sortOrder: list.length,
        isSystem: false,
      },
    ]);
    setRemovedKeys((r) => r.filter((x) => !(x.entity === entity && x.key === key)));
    setNewLabel("");
    setDirty(true);
  }

  function remove(key: string) {
    setStatuses((all) =>
      all.filter((s) => !(s.entity === entity && s.key === key))
    );
    setRemovedKeys((r) => [...r, { entity, key }]);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();

    const rows = statuses.map((s) => ({
      business_id: businessId,
      entity: s.entity,
      key: s.key,
      label: s.label,
      color: s.color,
      sort_order: s.sortOrder,
      is_system: s.isSystem,
    }));

    const { error } = await supabase
      .from("custom_statuses")
      .upsert(rows, { onConflict: "business_id,entity,key" });

    if (!error && removedKeys.length > 0) {
      for (const r of removedKeys) {
        await supabase
          .from("custom_statuses")
          .delete()
          .eq("business_id", businessId)
          .eq("entity", r.entity)
          .eq("key", r.key);
      }
    }

    setSaving(false);
    if (error) {
      const missingTable =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("schema cache");
      toast.error(
        missingTable
          ? "Run customization.sql in Supabase to enable custom statuses"
          : "Couldn't save statuses"
      );
      return;
    }
    setRemovedKeys([]);
    setDirty(false);
    toast.success("Statuses saved");
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
        <h1 className="text-2xl">Statuses &amp; Stages</h1>
        <p className="text-sm text-muted-foreground">
          Rename, recolor, reorder — or add your own vocabulary where it&apos;s
          safe to do so.
        </p>
      </div>

      {/* Entity tabs */}
      <div className="reveal flex gap-1.5 overflow-x-auto scrollbar-none" style={{ "--reveal-i": 1 } as React.CSSProperties}>
        {ENTITY_ORDER.map((e) => (
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
            {STATUS_ENTITY_META[e].label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{meta.desc}</p>

      <div className="flex flex-col gap-2">
        {list.map((s, i) => (
          <div
            key={s.key}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2"
          >
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Move ${s.label} up`}
                disabled={i === 0}
                onClick={() => move(s.key, -1)}
                className="press flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-25"
              >
                <span className="material-symbols-outlined text-[15px]">keyboard_arrow_up</span>
              </button>
              <button
                type="button"
                aria-label={`Move ${s.label} down`}
                disabled={i === list.length - 1}
                onClick={() => move(s.key, 1)}
                className="press flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-25"
              >
                <span className="material-symbols-outlined text-[15px]">keyboard_arrow_down</span>
              </button>
            </div>

            {/* Color */}
            <label className="relative shrink-0 cursor-pointer">
              <span
                className="block size-7 rounded-full ring-1 ring-border"
                style={{ background: s.color }}
              />
              <input
                type="color"
                value={s.color}
                onChange={(e) => patch(s.key, { color: e.target.value })}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                aria-label={`${s.label} color`}
              />
            </label>

            {/* Label */}
            <input
              type="text"
              value={s.label}
              onChange={(e) => patch(s.key, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium focus:border-border focus:bg-background focus:outline-none"
              aria-label={`${s.label} name`}
            />

            {s.isSystem ? (
              <span
                className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50"
                title="Built-in status — rename and recolor freely; the underlying key stays stable."
              >
                {s.key}
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Delete ${s.label}`}
                onClick={() => remove(s.key)}
                className="press flex size-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-destructive"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            )}
          </div>
        ))}

        {/* Add new */}
        {meta.allowCustom && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addStatus();
            }}
            className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2"
          >
            <span className="material-symbols-outlined text-[18px] text-muted-foreground">add</span>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={`Add a ${meta.label.toLowerCase().replace(/s$/, "")}…`}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newLabel.trim()}
              className="press rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground disabled:opacity-40"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {dirty && (
        <div className="glass-sheet fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-4 py-3 animate-in-down">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="press rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save statuses"}
          </button>
        </div>
      )}
    </div>
  );
}
