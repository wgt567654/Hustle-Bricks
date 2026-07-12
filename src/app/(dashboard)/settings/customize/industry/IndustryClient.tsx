"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import {
  INDUSTRY_TEMPLATES,
  type IndustryTemplate,
} from "@/lib/industry-templates";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
} from "@/lib/customization";

export default function IndustryClient({
  businessId,
  appliedTemplate,
}: {
  businessId: string;
  appliedTemplate: string | null;
}) {
  const router = useRouter();
  const [applied, setApplied] = useState<string | null>(appliedTemplate);
  const [confirming, setConfirming] = useState<IndustryTemplate | null>(null);
  const [applying, setApplying] = useState(false);

  async function apply(t: IndustryTemplate) {
    setApplying(true);
    const supabase = createClient();

    const theme = { ...DEFAULT_THEME, accentH: t.accentH, accentC: t.accentC };
    const { error } = await supabase.from("business_customization").upsert(
      {
        business_id: businessId,
        theme,
        quick_actions: t.quickActions,
        industry_template: t.id,
      },
      { onConflict: "business_id" }
    );

    if (!error) {
      if (t.extraLeadStages.length) {
        await supabase.from("custom_statuses").upsert(
          t.extraLeadStages.map((s, i) => ({
            business_id: businessId,
            entity: "lead",
            key: s.key,
            label: s.label,
            color: s.color,
            sort_order: 10 + i,
            is_system: false,
          })),
          { onConflict: "business_id,entity,key" }
        );
      }
      if (t.fields.length) {
        await supabase.from("custom_fields").upsert(
          t.fields.map((f, i) => ({
            business_id: businessId,
            entity: f.entity,
            key: f.key,
            label: f.label,
            field_type: f.fieldType,
            options: f.options ?? {},
            required: false,
            sort_order: i,
          })),
          { onConflict: "business_id,entity,key" }
        );
      }
    }

    setApplying(false);
    setConfirming(null);
    if (error) {
      const missingTable =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("schema cache");
      toast.error(
        missingTable
          ? "Run customization.sql in Supabase to enable templates"
          : "Couldn't apply template"
      );
      return;
    }
    applyThemeToDocument(theme);
    setApplied(t.id);
    toast.success(`${t.name} setup applied`);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings/customize"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Customize Studio
        </Link>
        <h1 className="text-2xl">Industry Templates</h1>
        <p className="text-sm text-muted-foreground">
          A head start tuned for your trade — brand accent, shortcuts, pipeline
          stages, and the fields crews actually need. Applying adds to your
          setup; it never removes anything.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRY_TEMPLATES.map((t, i) => {
          const isApplied = applied === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setConfirming(t)}
              className={`press reveal flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors ${
                isApplied ? "border-primary" : "border-border hover:border-primary/40"
              }`}
              style={{ "--reveal-i": i + 1 } as React.CSSProperties}
            >
              <span
                className="material-symbols-outlined flex size-10 items-center justify-center rounded-xl text-[22px]"
                style={{
                  color: `oklch(0.52 ${t.accentC} ${t.accentH})`,
                  background: `oklch(0.52 ${t.accentC} ${t.accentH} / 0.12)`,
                }}
              >
                {t.icon}
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                {t.name}
                {isApplied && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Applied
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {t.fields.length} fields · {t.quickActions.length} shortcuts
                {t.extraLeadStages.length > 0 &&
                  ` · ${t.extraLeadStages.length} pipeline stage${t.extraLeadStages.length > 1 ? "s" : ""}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Confirm sheet */}
      {confirming && (
        <div className="glass-sheet fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 px-4 py-5 animate-in-down">
          <p className="text-sm font-semibold">
            Apply the {confirming.name} setup?
          </p>
          <p className="max-w-sm text-center text-xs text-muted-foreground">
            Adds the {confirming.name.toLowerCase()} accent, quick actions,
            {confirming.extraLeadStages.length > 0 && " pipeline stages,"} and
            custom fields. Nothing you&apos;ve built is removed.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="press rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => apply(confirming)}
              disabled={applying}
              className="press rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply template"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
