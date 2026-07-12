"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export type WidgetMeta = {
  id: string;
  label: string;
  icon: string;
  /** grid columns out of 6 */
  defaultSpan: 2 | 3 | 4 | 6;
};

export type LayoutItem = { id: string; span: 2 | 3 | 4 | 6; hidden: boolean };

const SPAN_CLASS: Record<number, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
};

const SPAN_CYCLE: (2 | 3 | 4 | 6)[] = [2, 3, 4, 6];

function defaultLayout(widgets: WidgetMeta[]): LayoutItem[] {
  return widgets.map((w) => ({ id: w.id, span: w.defaultSpan, hidden: false }));
}

/** Saved layout merged against the registry: unknown ids dropped, new
 *  widgets appended visible — so shipped widgets never vanish. */
function mergeLayout(
  widgets: WidgetMeta[],
  saved: LayoutItem[] | null
): LayoutItem[] {
  if (!saved || saved.length === 0) return defaultLayout(widgets);
  const known = new Map(widgets.map((w) => [w.id, w]));
  const seen = new Set<string>();
  const merged: LayoutItem[] = [];
  for (const item of saved) {
    const meta = known.get(item.id);
    if (!meta || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push({
      id: item.id,
      span: SPAN_CYCLE.includes(item.span) ? item.span : meta.defaultSpan,
      hidden: !!item.hidden,
    });
  }
  for (const w of widgets) {
    if (!seen.has(w.id)) {
      merged.push({ id: w.id, span: w.defaultSpan, hidden: false });
    }
  }
  return merged;
}

export default function DashboardGrid({
  businessId,
  widgets,
  slots,
  savedLayout,
}: {
  businessId: string;
  widgets: WidgetMeta[];
  slots: Record<string, React.ReactNode>;
  savedLayout: LayoutItem[] | null;
}) {
  const initial = useMemo(
    () => mergeLayout(widgets, savedLayout),
    [widgets, savedLayout]
  );
  const [layout, setLayout] = useState<LayoutItem[]>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const metaById = useMemo(
    () => new Map(widgets.map((w) => [w.id, w])),
    [widgets]
  );

  function move(id: string, dir: -1 | 1) {
    setLayout((l) => {
      const i = l.findIndex((x) => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function cycleSpan(id: string) {
    setLayout((l) =>
      l.map((x) =>
        x.id === id
          ? {
              ...x,
              span: SPAN_CYCLE[(SPAN_CYCLE.indexOf(x.span) + 1) % SPAN_CYCLE.length],
            }
          : x
      )
    );
  }

  function setHidden(id: string, hidden: boolean) {
    setLayout((l) => l.map((x) => (x.id === id ? { ...x, hidden } : x)));
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    let error = null as { code?: string; message?: string } | null;
    try {
      const { data: existing, error: selErr } = await supabase
        .from("dashboards")
        .select("id")
        .eq("user_id", user.id)
        .eq("business_id", businessId)
        .eq("is_default", true)
        .maybeSingle();
      if (selErr) {
        error = selErr;
      } else if (existing) {
        const { error: updErr } = await supabase
          .from("dashboards")
          .update({ layout })
          .eq("id", existing.id);
        error = updErr;
      } else {
        const { error: insErr } = await supabase.from("dashboards").insert({
          business_id: businessId,
          user_id: user.id,
          is_default: true,
          name: "My Dashboard",
          layout,
        });
        error = insErr;
      }
    } catch (e) {
      error = { message: String(e) };
    }

    setSaving(false);
    if (error) {
      const missingTable =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("schema cache");
      toast.error(
        missingTable
          ? "Run customization.sql in Supabase to save layouts"
          : "Couldn't save your layout"
      );
      return;
    }
    setEditing(false);
    toast.success("Dashboard layout saved");
  }

  function resetToDefault() {
    setLayout(defaultLayout(widgets));
  }

  const hiddenItems = layout.filter((x) => x.hidden);

  return (
    <div className="flex flex-col gap-4">
      {/* Customize toggle */}
      <div className="flex items-center justify-end -mb-2">
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="press inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <span className="material-symbols-outlined text-[15px]">tune</span>
            Customize
          </button>
        ) : (
          <button
            type="button"
            onClick={resetToDefault}
            className="press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            Reset layout
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
        {layout.map((item, i) => {
          if (item.hidden && !editing) return null;
          const meta = metaById.get(item.id);
          if (!meta || !slots[item.id]) return null;
          return (
            <div
              key={item.id}
              className={`relative min-w-0 ${SPAN_CLASS[item.span]} ${
                item.hidden ? "opacity-40" : ""
              }`}
            >
              {editing && (
                <div className="absolute -top-2.5 right-2 z-20 flex items-center gap-0.5 rounded-full border border-border bg-card px-1 py-0.5 shadow-card">
                  <button
                    type="button"
                    aria-label={`Move ${meta.label} earlier`}
                    disabled={i === 0}
                    onClick={() => move(item.id, -1)}
                    className="press flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-25"
                  >
                    <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${meta.label} later`}
                    disabled={i === layout.length - 1}
                    onClick={() => move(item.id, 1)}
                    className="press flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-25"
                  >
                    <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Resize ${meta.label}`}
                    onClick={() => cycleSpan(item.id)}
                    className="press hidden lg:flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <span className="material-symbols-outlined text-[15px]">width</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${item.hidden ? "Show" : "Hide"} ${meta.label}`}
                    onClick={() => setHidden(item.id, !item.hidden)}
                    className="press flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {item.hidden ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>
              )}
              {slots[item.id]}
            </div>
          );
        })}
      </div>

      {/* Hidden widget shelf (edit mode) */}
      {editing && hiddenItems.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Hidden: {hiddenItems.map((h) => metaById.get(h.id)?.label).join(" · ")}{" "}
          — tap the eye to bring one back.
        </p>
      )}

      {editing && (
        <div className="glass-sheet fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-4 py-3 animate-in-down">
          <button
            type="button"
            onClick={() => {
              setLayout(mergeLayout(widgets, savedLayout));
              setEditing(false);
            }}
            className="press rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="press rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save layout"}
          </button>
        </div>
      )}
    </div>
  );
}
