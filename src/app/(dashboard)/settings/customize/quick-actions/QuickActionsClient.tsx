"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { QUICK_ACTION_REGISTRY } from "@/lib/quick-actions";

export default function QuickActionsClient({
  businessId,
  initialSelection,
}: {
  businessId: string;
  initialSelection: string[];
}) {
  const [selection, setSelection] = useState<string[]>(initialSelection);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function toggle(id: string) {
    setSelection((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]
    );
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("business_customization")
      .upsert(
        { business_id: businessId, quick_actions: selection },
        { onConflict: "business_id" }
      );
    setSaving(false);
    if (error) {
      const missingTable =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("schema cache");
      toast.error(
        missingTable
          ? "Run customization.sql in Supabase to enable quick actions"
          : "Couldn't save quick actions"
      );
      return;
    }
    setDirty(false);
    toast.success("Quick actions saved");
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
        <h1 className="text-2xl">Quick Actions</h1>
        <p className="text-sm text-muted-foreground">
          Pick the shortcuts your team reaches for hourly. They appear on your
          dashboard in the order you select them.
        </p>
      </div>

      <div className="reveal grid grid-cols-2 gap-2 sm:grid-cols-3" style={{ "--reveal-i": 1 } as React.CSSProperties}>
        {QUICK_ACTION_REGISTRY.map((a) => {
          const idx = selection.indexOf(a.id);
          const selected = idx !== -1;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              aria-pressed={selected}
              className={`press relative flex flex-col items-start gap-2 rounded-2xl border bg-card p-3 text-left transition-colors ${
                selected
                  ? "border-primary"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <span
                className={`material-symbols-outlined flex size-9 items-center justify-center rounded-xl text-[20px] ${
                  selected ? "icon-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {a.icon}
              </span>
              <span className={`text-sm ${selected ? "font-semibold" : "font-medium"}`}>
                {a.label}
              </span>
              {selected && (
                <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {idx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {dirty && (
        <div className="glass-sheet fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-4 py-3 animate-in-down">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="press rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save quick actions"}
          </button>
        </div>
      )}
    </div>
  );
}
