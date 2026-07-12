"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import {
  ACCENT_PRESETS,
  applyThemeToDocument,
  type ThemeSettings,
} from "@/lib/customization";

const RADIUS_CHOICES = [
  { label: "Sharp", value: 0.5 },
  { label: "Standard", value: 1 },
  { label: "Soft", value: 1.5 },
];

const DENSITY_CHOICES = [
  { label: "Comfortable", value: 1, desc: "Roomy spacing, larger touch targets" },
  { label: "Compact", value: 0.875, desc: "Tighter spacing, more on screen" },
];

export default function AppearanceClient({
  businessId,
  initialTheme,
}: {
  businessId: string;
  initialTheme: ThemeSettings;
}) {
  const [draft, setDraft] = useState<ThemeSettings>(initialTheme);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const savedRef = useRef<ThemeSettings>(initialTheme);
  const { theme: mode, setTheme: setMode } = useTheme();

  // next-themes only knows the mode after mount; avoid a hydration mismatch
  useEffect(() => setMounted(true), []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(savedRef.current);

  // Live preview: every change restyles the whole app instantly.
  function update(patch: Partial<ThemeSettings>) {
    setDraft((d) => {
      const next = { ...d, ...patch };
      applyThemeToDocument(next);
      return next;
    });
  }

  // Leaving without saving reverts the live preview.
  useEffect(() => {
    return () => applyThemeToDocument(savedRef.current);
  }, []);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("business_customization")
      .upsert(
        { business_id: businessId, theme: draft },
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
          ? "Run customization.sql in Supabase to enable themes"
          : "Couldn't save theme"
      );
      return;
    }
    savedRef.current = draft;
    toast.success("Theme saved for your whole team");
  }

  function revert() {
    setDraft(savedRef.current);
    applyThemeToDocument(savedRef.current);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-6 pb-28">
      {/* Header */}
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Settings
        </Link>
        <h1 className="text-2xl">Appearance</h1>
        <p className="text-sm text-muted-foreground">
          Your business. Your workflow. Your operating system. Changes preview
          live — save to apply for your whole team.
        </p>
      </div>

      {/* Accent */}
      <section className="reveal flex flex-col gap-3" style={{ "--reveal-i": 1 } as React.CSSProperties}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Accent color
          </h3>
          <p className="text-sm text-muted-foreground">
            Recolors buttons, links, charts, and navigation across the app.
          </p>
        </div>
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
          {ACCENT_PRESETS.map((p) => {
            const selected = draft.accentH === p.h && draft.accentC === p.c;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => update({ accentH: p.h, accentC: p.c })}
                className="press group flex flex-col items-center gap-1.5"
                aria-pressed={selected}
              >
                <span
                  className={`size-9 rounded-full transition-shadow ${
                    selected
                      ? "ring-2 ring-offset-2 ring-offset-background"
                      : "ring-1 ring-border group-hover:ring-2"
                  }`}
                  style={{
                    background: `oklch(0.52 ${p.c} ${p.h})`,
                    ...(selected ? { boxShadow: `0 0 0 2px oklch(0.52 ${p.c} ${p.h})` } : {}),
                  }}
                />
                <span
                  className={`text-[11px] ${
                    selected ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Corners */}
      <section className="reveal flex flex-col gap-3" style={{ "--reveal-i": 2 } as React.CSSProperties}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Corners
          </h3>
          <p className="text-sm text-muted-foreground">
            How rounded cards, buttons, and inputs feel.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {RADIUS_CHOICES.map((r) => {
            const selected = draft.radiusScale === r.value;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => update({ radiusScale: r.value })}
                aria-pressed={selected}
                className={`press flex flex-col items-center gap-2 border bg-card p-4 transition-colors ${
                  selected ? "border-primary" : "border-border hover:border-muted-foreground/40"
                }`}
                style={{ borderRadius: `${0.75 * r.value}rem` }}
              >
                <span
                  className="h-10 w-full border-2 border-current text-primary/70"
                  style={{ borderRadius: `${0.75 * r.value}rem` }}
                />
                <span className={`text-sm ${selected ? "font-semibold" : "text-muted-foreground"}`}>
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Density */}
      <section className="reveal flex flex-col gap-3" style={{ "--reveal-i": 3 } as React.CSSProperties}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Density
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DENSITY_CHOICES.map((d) => {
            const selected = draft.density === d.value;
            return (
              <button
                key={d.label}
                type="button"
                onClick={() => update({ density: d.value })}
                aria-pressed={selected}
                className={`press flex flex-col items-start gap-1 rounded-2xl border bg-card p-4 text-left transition-colors ${
                  selected ? "border-primary" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <span className={`text-sm ${selected ? "font-semibold" : ""}`}>{d.label}</span>
                <span className="text-xs text-muted-foreground">{d.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Surfaces */}
      <section className="reveal flex flex-col gap-3" style={{ "--reveal-i": 4 } as React.CSSProperties}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Surfaces
          </h3>
        </div>
        <button
          type="button"
          onClick={() => update({ glass: !draft.glass })}
          className="press flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
          aria-pressed={draft.glass}
        >
          <div>
            <p className="text-sm font-medium">Frosted glass effects</p>
            <p className="text-xs text-muted-foreground">
              Translucent, blurred navigation and panels. Turn off for solid
              surfaces and maximum contrast.
            </p>
          </div>
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              draft.glass ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
                draft.glass ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </section>

      {/* Mode — personal, stored on this device */}
      <section className="reveal flex flex-col gap-3" style={{ "--reveal-i": 5 } as React.CSSProperties}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Mode
          </h3>
          <p className="text-sm text-muted-foreground">
            Personal preference — saved on this device only.
          </p>
        </div>
        <div className="grid w-fit grid-cols-3 overflow-hidden rounded-xl border border-border">
          {(["light", "dark", "system"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm capitalize transition-colors ${
                mounted && mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      {/* Sticky save bar */}
      {dirty && (
        <div className="glass-sheet fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-4 py-3 animate-in-down">
          <button
            type="button"
            onClick={revert}
            className="press rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Revert
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="press rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save theme"}
          </button>
        </div>
      )}
    </div>
  );
}
