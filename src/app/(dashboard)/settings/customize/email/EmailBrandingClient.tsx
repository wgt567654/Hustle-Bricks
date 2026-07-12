"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { brandedEmailShell } from "@/lib/email-branding";
import type { EmailBranding } from "@/lib/customization";

const PREVIEW_BODY = `
  <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#374151">Hi Sarah,</p>
  <p style="margin:0;font-size:16px;line-height:1.7;color:#374151">
    Great news — you're officially on the schedule. This is how your emails
    will look to customers.
  </p>
`;

export default function EmailBrandingClient({
  businessId,
  businessName,
  logoUrl,
  initialBranding,
}: {
  businessId: string;
  businessName: string;
  logoUrl: string | null;
  initialBranding: EmailBranding;
}) {
  const [baseline, setBaseline] = useState(initialBranding);
  const [draft, setDraft] = useState<EmailBranding>(initialBranding);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const previewHtml = useMemo(
    () =>
      brandedEmailShell({
        businessName,
        logoUrl,
        branding: draft,
        subheadline: `Appointment confirmed with ${businessName}`,
        headline: "You're all booked!",
        bodyHtml: PREVIEW_BODY,
        footerNote: `You're receiving this email because you have an upcoming service scheduled with ${businessName}.`,
      }),
    [businessName, logoUrl, draft]
  );

  function update(patch: Partial<EmailBranding>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("business_customization").upsert(
      { business_id: businessId, email_branding: draft },
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
          ? "Run customization.sql in Supabase to enable email branding"
          : "Couldn't save email branding"
      );
      return;
    }
    setBaseline(draft);
    toast.success("Every email now matches your brand");
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 pb-28">
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings/customize"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Customize Studio
        </Link>
        <h1 className="text-2xl">Email Branding</h1>
        <p className="text-sm text-muted-foreground">
          Confirmations, invoices, and booking links all wear your brand.
          {logoUrl ? " Your logo is pulled from Settings → Company." : " Upload a logo in Settings → Company to replace the text header."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls */}
        <div className="reveal flex flex-col gap-5" style={{ "--reveal-i": 1 } as React.CSSProperties}>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <span>
              <span className="block text-sm font-medium">Accent color</span>
              <span className="block text-xs text-muted-foreground">
                Header, buttons, and links
              </span>
            </span>
            <span className="relative">
              <span
                className="block size-9 rounded-full ring-1 ring-border"
                style={{ background: draft.accentColor }}
              />
              <input
                type="color"
                value={draft.accentColor}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                aria-label="Email accent color"
              />
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="eb-header">Header text</label>
            <input
              id="eb-header"
              type="text"
              value={draft.headerText}
              onChange={(e) => update({ headerText: e.target.value })}
              placeholder={businessName}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus-visible:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="eb-signature">Signature</label>
            <textarea
              id="eb-signature"
              rows={3}
              value={draft.signature}
              onChange={(e) => update({ signature: e.target.value })}
              placeholder={`— The ${businessName} team`}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus-visible:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="eb-footer">Footer text</label>
            <input
              id="eb-footer"
              type="text"
              value={draft.footerText}
              onChange={(e) => update({ footerText: e.target.value })}
              placeholder="Why the customer is receiving this email"
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus-visible:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="eb-disclaimer">Legal disclaimer</label>
            <textarea
              id="eb-disclaimer"
              rows={2}
              value={draft.disclaimer}
              onChange={(e) => update({ disclaimer: e.target.value })}
              placeholder="e.g. Licensed & insured. CA License #123456."
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus-visible:border-primary"
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="reveal" style={{ "--reveal-i": 2 } as React.CSSProperties}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Live preview
          </p>
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            sandbox=""
            className="h-[560px] w-full rounded-2xl border border-border bg-white"
          />
        </div>
      </div>

      {dirty && (
        <div className="glass-sheet fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-4 py-3 animate-in-down">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="press rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save email branding"}
          </button>
        </div>
      )}
    </div>
  );
}
