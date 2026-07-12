import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_EMAIL_BRANDING,
  type EmailBranding,
} from "@/lib/customization";

/* ============================================================================
   Branded email shell — the shared table-layout HTML every outbound email
   uses, tokenized on the business's email branding. Defaults reproduce the
   previous hardcoded design (indigo #6366f1) exactly.
   ============================================================================ */

const DEFAULT_ACCENT = "#6366f1";

export type EmailShellInput = {
  businessName: string;
  logoUrl?: string | null;
  branding: EmailBranding;
  /** small uppercase line above the headline */
  subheadline: string;
  headline: string;
  /** pre-built inner HTML */
  bodyHtml: string;
  ctaHtml?: string;
  /** default footer sentence when the business hasn't customized one */
  footerNote: string;
  replyTo?: string | null;
};

export async function getEmailBranding(
  supabase: SupabaseClient,
  businessId: string
): Promise<EmailBranding> {
  try {
    const { data, error } = await supabase
      .from("business_customization")
      .select("email_branding")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error || !data?.email_branding) return DEFAULT_EMAIL_BRANDING;
    return {
      ...DEFAULT_EMAIL_BRANDING,
      ...(data.email_branding as Partial<EmailBranding>),
    };
  } catch {
    return DEFAULT_EMAIL_BRANDING;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function brandedEmailShell(input: EmailShellInput): string {
  const {
    businessName,
    logoUrl,
    branding,
    subheadline,
    headline,
    bodyHtml,
    ctaHtml = "",
    footerNote,
    replyTo,
  } = input;

  const accent =
    branding.accentColor && branding.accentColor !== DEFAULT_EMAIL_BRANDING.accentColor
      ? branding.accentColor
      : DEFAULT_ACCENT;

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(businessName)}" height="36" style="display:inline-block;max-height:36px;border:0" />`
    : `<p style="margin:0;font-size:15px;font-weight:800;letter-spacing:0.05em;color:${accent};text-transform:uppercase">◆ ${esc(
        branding.headerText || businessName
      )}</p>`;

  const signatureHtml = branding.signature
    ? `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#374151;white-space:pre-line">${esc(branding.signature)}</p>`
    : "";

  const socialHtml = branding.socialLinks?.length
    ? `<p style="margin:8px 0 0;font-size:12px">${branding.socialLinks
        .map(
          (l) =>
            `<a href="${esc(l.url)}" style="color:${accent};text-decoration:none;margin-right:12px">${esc(l.label)}</a>`
        )
        .join("")}</p>`
    : "";

  const disclaimerHtml = branding.disclaimer
    ? `<p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1">${esc(branding.disclaimer)}</p>`
    : "";

  const footerText = branding.footerText || footerNote;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;min-height:100vh">
    <tr><td align="center" style="padding:40px 16px">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">

        <tr><td align="center" style="padding-bottom:24px">
          ${logoHtml}
        </td></tr>

        <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:linear-gradient(135deg,${accent} 0%,${accent}dd 100%);padding:36px 40px 32px">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${esc(subheadline)}</p>
              <h1 style="margin:0;font-size:30px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.02em">${esc(headline)}</h1>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:36px 40px 28px">
              ${bodyHtml}
              ${ctaHtml}
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:0 40px"><hr style="border:none;border-top:1px solid #f1f5f9;margin:0"></td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:24px 40px 32px">
              ${signatureHtml}
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151">${esc(businessName)}</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af">
                ${esc(footerText)}
                ${replyTo ? `Reply to this email or contact us at <a href="mailto:${esc(replyTo)}" style="color:${accent};text-decoration:none">${esc(replyTo)}</a>.` : "Simply reply to this email to reach us."}
              </p>
              ${socialHtml}
              ${disclaimerHtml}
            </td></tr>
          </table>

        </td></tr>

        <tr><td align="center" style="padding-top:20px">
          <p style="margin:0;font-size:11px;color:#cbd5e1">Powered by <strong style="color:#94a3b8">HustleBricks</strong></p>
        </td></tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}
