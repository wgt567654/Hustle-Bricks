"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import {
  AUTOMATED_MESSAGES,
  TEMPLATE_VARIABLES,
  renderTemplate,
  type AutomatedMessageDef,
} from "@/lib/automated-messages";

export default function TemplatesClient({
  businessId,
  businessName,
  initialOverrides,
}: {
  businessId: string;
  businessName: string;
  initialOverrides: Record<string, string>;
}) {
  const [overrides, setOverrides] = useState(initialOverrides);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const groups = useMemo(() => {
    const g = new Map<string, AutomatedMessageDef[]>();
    for (const m of AUTOMATED_MESSAGES) {
      g.set(m.group, [...(g.get(m.group) ?? []), m]);
    }
    return [...g.entries()];
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings/customize"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Customize Studio
        </Link>
        <h1 className="text-2xl">Message Templates</h1>
        <p className="text-sm text-muted-foreground">
          Every automated message, in your words. Click a template to edit it —
          variables fill in automatically when messages send. Per-service
          booking texts live in{" "}
          <Link href="/settings?sec=messages" className="text-primary underline-offset-2 hover:underline">
            Settings → Messages
          </Link>
          .
        </p>
      </div>

      {groups.map(([group, defs], gi) => (
        <section
          key={group}
          className="reveal flex flex-col gap-2"
          style={{ "--reveal-i": gi + 1 } as React.CSSProperties}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {group}
          </h3>
          {defs.map((def) => (
            <TemplateRow
              key={def.key}
              def={def}
              businessId={businessId}
              businessName={businessName}
              override={overrides[def.key]}
              open={openKey === def.key}
              onToggle={() => setOpenKey(openKey === def.key ? null : def.key)}
              onSaved={(body) =>
                setOverrides((o) => ({ ...o, [def.key]: body }))
              }
              onReset={() =>
                setOverrides((o) => {
                  const next = { ...o };
                  delete next[def.key];
                  return next;
                })
              }
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function TemplateRow({
  def,
  businessId,
  businessName,
  override,
  open,
  onToggle,
  onSaved,
  onReset,
}: {
  def: AutomatedMessageDef;
  businessId: string;
  businessName: string;
  override?: string;
  open: boolean;
  onToggle: () => void;
  onSaved: (body: string) => void;
  onReset: () => void;
}) {
  const [body, setBody] = useState(override ?? def.defaultBody);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const customized = override !== undefined;

  const previewVars = { ...TEMPLATE_VARIABLES, CompanyName: businessName };
  const preview = renderTemplate(body, previewVars);

  function insertVariable(name: string) {
    const el = textareaRef.current;
    const token = `{{${name}}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("message_templates")
      .upsert(
        {
          business_id: businessId,
          service_type: "*",
          message_type: def.key,
          channel: def.channel,
          body,
        },
        { onConflict: "business_id,service_type,message_type" }
      )
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      // version history snapshot — best-effort
      await supabase.from("message_template_versions").insert({
        template_id: data.id,
        business_id: businessId,
        body,
      });
    }

    setSaving(false);
    if (error) {
      const missingTable =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("schema cache");
      toast.error(
        missingTable
          ? "Run customization.sql in Supabase to enable templates"
          : "Couldn't save template"
      );
      return;
    }
    onSaved(body);
    toast.success("Template saved");
  }

  async function resetToDefault() {
    const supabase = createClient();
    await supabase
      .from("message_templates")
      .delete()
      .eq("business_id", businessId)
      .eq("service_type", "*")
      .eq("message_type", def.key);
    setBody(def.defaultBody);
    onReset();
    toast.success("Restored default wording");
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span
          className={`material-symbols-outlined flex size-8 shrink-0 items-center justify-center rounded-lg text-[17px] ${
            def.channel === "sms" ? "icon-teal" : "icon-orange"
          }`}
        >
          {def.channel === "sms" ? "sms" : "mail"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            {def.label}
            {customized && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                Customized
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {def.timing}
          </span>
        </span>
        <span className="material-symbols-outlined text-[20px] text-muted-foreground">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-4">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus-visible:border-primary"
            aria-label={`${def.label} template`}
          />

          <div className="flex flex-wrap gap-1.5">
            {def.variables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="press rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              >
                {"{{"}{v}{"}}"}
              </button>
            ))}
          </div>

          {/* Live preview as the customer sees it */}
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Preview
            </p>
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-card px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">
              {preview}
            </div>
          </div>

          <div className="flex items-center justify-between">
            {customized ? (
              <button
                type="button"
                onClick={resetToDefault}
                className="press text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Restore default
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || !body.trim()}
              className="press rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save template"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
