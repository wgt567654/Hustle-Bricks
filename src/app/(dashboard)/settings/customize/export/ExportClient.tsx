"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type SetupExport = {
  version: 1;
  app: "hustlebricks";
  customization?: Record<string, unknown> | null;
  statuses?: Record<string, unknown>[];
  fields?: Record<string, unknown>[];
  templates?: Record<string, unknown>[];
  automations?: Record<string, unknown>[];
};

export default function ExportClient({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const [working, setWorking] = useState<"export" | "import" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function doExport() {
    setWorking("export");
    const supabase = createClient();

    const grab = async (table: string, cols: string) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .select(cols)
          .eq("business_id", businessId);
        return error ? null : data;
      } catch {
        return null;
      }
    };

    const [customizationRows, statuses, fields, templates, automations] =
      await Promise.all([
        grab(
          "business_customization",
          "theme, modules, ai_personality, quick_actions, email_branding, industry_template"
        ),
        grab("custom_statuses", "entity, key, label, color, sort_order, is_system"),
        grab("custom_fields", "entity, key, label, field_type, options, required, sort_order"),
        grab("message_templates", "service_type, message_type, channel, subject, body"),
        grab("automations", "name, trigger, enabled, steps"),
      ]);

    const payload: SetupExport = {
      version: 1,
      app: "hustlebricks",
      customization:
        (customizationRows as unknown as Record<string, unknown>[] | null)?.[0] ??
        null,
      statuses: (statuses as unknown as Record<string, unknown>[]) ?? [],
      fields: (fields as unknown as Record<string, unknown>[]) ?? [],
      templates: (templates as unknown as Record<string, unknown>[]) ?? [],
      automations: (automations as unknown as Record<string, unknown>[]) ?? [],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hustlebricks-setup-${businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setWorking(null);
    toast.success("Setup exported");
  }

  async function doImport(file: File) {
    setWorking("import");
    const supabase = createClient();
    let parsed: SetupExport;
    try {
      parsed = JSON.parse(await file.text());
      if (parsed.app !== "hustlebricks" || parsed.version !== 1) {
        throw new Error("wrong format");
      }
    } catch {
      setWorking(null);
      toast.error("That file isn't a HustleBricks setup export");
      return;
    }

    const results: string[] = [];

    if (parsed.customization) {
      const { error } = await supabase
        .from("business_customization")
        .upsert(
          { ...parsed.customization, business_id: businessId },
          { onConflict: "business_id" }
        );
      if (!error) results.push("appearance & preferences");
    }

    if (parsed.statuses?.length) {
      const { error } = await supabase.from("custom_statuses").upsert(
        parsed.statuses.map((s) => ({ ...s, business_id: businessId })),
        { onConflict: "business_id,entity,key" }
      );
      if (!error) results.push(`${parsed.statuses.length} statuses`);
    }

    if (parsed.fields?.length) {
      const { error } = await supabase.from("custom_fields").upsert(
        parsed.fields.map((f) => ({ ...f, business_id: businessId })),
        { onConflict: "business_id,entity,key" }
      );
      if (!error) results.push(`${parsed.fields.length} custom fields`);
    }

    if (parsed.templates?.length) {
      const { error } = await supabase.from("message_templates").upsert(
        parsed.templates.map((t) => ({ ...t, business_id: businessId })),
        { onConflict: "business_id,service_type,message_type" }
      );
      if (!error) results.push(`${parsed.templates.length} templates`);
    }

    if (parsed.automations?.length) {
      const { error } = await supabase
        .from("automations")
        .insert(
          parsed.automations.map((a) => ({ ...a, business_id: businessId }))
        );
      if (!error) results.push(`${parsed.automations.length} automations`);
    }

    setWorking(null);
    if (results.length === 0) {
      toast.error(
        "Nothing imported — run customization.sql in Supabase first"
      );
      return;
    }
    toast.success(`Imported ${results.join(", ")}`);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings/customize"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Customize Studio
        </Link>
        <h1 className="text-2xl">Import &amp; Export</h1>
        <p className="text-sm text-muted-foreground">
          Your entire setup — theme, modules, statuses, custom fields,
          templates, AI instructions, automations — as one portable file.
          Built for franchises and multi-location teams.
        </p>
      </div>

      <div className="reveal grid gap-3 sm:grid-cols-2" style={{ "--reveal-i": 1 } as React.CSSProperties}>
        <button
          type="button"
          onClick={doExport}
          disabled={working !== null}
          className="press flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
        >
          <span className="icon-primary flex size-10 items-center justify-center rounded-xl">
            <span className="material-symbols-outlined text-[22px]">download</span>
          </span>
          <span>
            <span className="block text-sm font-semibold">
              {working === "export" ? "Exporting…" : "Export setup"}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Download this location&apos;s configuration as a JSON file.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={working !== null}
          className="press flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
        >
          <span className="icon-violet flex size-10 items-center justify-center rounded-xl">
            <span className="material-symbols-outlined text-[22px]">upload</span>
          </span>
          <span>
            <span className="block text-sm font-semibold">
              {working === "import" ? "Importing…" : "Import setup"}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Apply a setup file to this business. Existing values are
              overwritten where they overlap.
            </span>
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
