"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { MODULE_REGISTRY } from "@/lib/modules";
import type { ModulesSettings } from "@/lib/customization";

export default function ModulesClient({
  businessId,
  initialModules,
}: {
  businessId: string;
  initialModules: ModulesSettings;
}) {
  const router = useRouter();
  // Full ordered id list (settings order first, then registry order)
  const startOrder = (() => {
    const ids = MODULE_REGISTRY.map((m) => m.id);
    const fromSettings = initialModules.order.filter((id) => ids.includes(id));
    const rest = ids.filter((id) => !fromSettings.includes(id));
    return [...fromSettings, ...rest];
  })();

  const [order, setOrder] = useState<string[]>(startOrder);
  const [disabled, setDisabled] = useState<Set<string>>(
    new Set(initialModules.disabled)
  );
  const [pinned, setPinned] = useState<Set<string>>(
    new Set(initialModules.pinned)
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const byId = new Map(MODULE_REGISTRY.map((m) => [m.id, m]));

  function move(id: string, dir: -1 | 1) {
    setOrder((o) => {
      const i = o.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }

  function toggleSet(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    id: string
  ) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const payload: ModulesSettings = {
      order,
      disabled: [...disabled],
      pinned: [...pinned],
    };
    const { error } = await supabase
      .from("business_customization")
      .upsert(
        { business_id: businessId, modules: payload },
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
          ? "Run customization.sql in Supabase to enable modules"
          : "Couldn't save modules"
      );
      return;
    }
    setDirty(false);
    toast.success("Navigation updated");
    router.refresh();
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
        <h1 className="text-2xl">Modules</h1>
        <p className="text-sm text-muted-foreground">
          Hide what you don&apos;t use, reorder the rest, and pin your
          most-used modules to the front of navigation. Hidden modules stay
          fully functional — they just leave the nav.
        </p>
      </div>

      <div className="reveal flex flex-col gap-2" style={{ "--reveal-i": 1 } as React.CSSProperties}>
        {order.map((id, i) => {
          const mod = byId.get(id);
          if (!mod) return null;
          const isOff = disabled.has(id);
          const isPinned = pinned.has(id);
          return (
            <div
              key={id}
              className={`flex items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 transition-opacity ${
                isOff ? "border-border opacity-55" : "border-border"
              }`}
            >
              {/* Reorder */}
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${mod.label} up`}
                  disabled={i === 0}
                  onClick={() => move(id, -1)}
                  className="press flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-25"
                >
                  <span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
                </button>
                <button
                  type="button"
                  aria-label={`Move ${mod.label} down`}
                  disabled={i === order.length - 1}
                  onClick={() => move(id, 1)}
                  className="press flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-25"
                >
                  <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
                </button>
              </div>

              <div className="icon-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                <span className="material-symbols-outlined text-[20px]">{mod.icon}</span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{mod.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {mod.items.map((it) => it.label).join(" · ")}
                </p>
              </div>

              {/* Pin */}
              {!mod.required && (
                <button
                  type="button"
                  aria-label={`Pin ${mod.label}`}
                  aria-pressed={isPinned}
                  onClick={() => toggleSet(pinned, setPinned, id)}
                  className={`press flex size-8 items-center justify-center rounded-lg ${
                    isPinned ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: isPinned ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    keep
                  </span>
                </button>
              )}

              {/* Visibility */}
              {mod.required ? (
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Always on
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`${isOff ? "Enable" : "Disable"} ${mod.label}`}
                  aria-pressed={!isOff}
                  onClick={() => toggleSet(disabled, setDisabled, id)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    !isOff ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
                      !isOff ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              )}
            </div>
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
            {saving ? "Saving…" : "Save navigation"}
          </button>
        </div>
      )}
    </div>
  );
}
