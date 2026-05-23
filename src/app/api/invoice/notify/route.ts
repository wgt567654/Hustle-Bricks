import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendSMS } from "@/lib/sms";
import { formatCurrency } from "@/lib/currency";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select(`
      id, total, scheduled_at, completed_at, invoice_auto_sent_at, client_id,
      clients ( id, name, phone, email ),
      businesses ( id, name, contact_email, currency, auto_invoice_enabled )
    `)
    .eq("id", jobId)
    .single();

  type JobData = {
    id: string;
    total: number;
    scheduled_at: string | null;
    completed_at: string | null;
    invoice_auto_sent_at: string | null;
    client_id: string | null;
    clients: { id: string; name: string; phone: string | null; email: string | null } | null;
    businesses: { id: string; name: string | null; contact_email: string | null; currency: string | null; auto_invoice_enabled: boolean } | null;
  };

  const j = job as unknown as JobData;

  if (!j) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (j.businesses?.auto_invoice_enabled === false) {
    return NextResponse.json({ skipped: true, reason: "auto_invoice_disabled" });
  }
  if (j.invoice_auto_sent_at) {
    return NextResponse.json({ skipped: true, reason: "already_sent" });
  }

  const client = j.clients;
  if (!client) return NextResponse.json({ error: "No client on job" }, { status: 400 });

  const bizName = j.businesses?.name ?? "Your service provider";
  const currency = j.businesses?.currency ?? "USD";
  const firstName = client.name.split(" ")[0];
  const amount = formatCurrency(j.total, currency);
  const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${j.id}`;

  const results: Record<string, unknown> = {};

  // SMS notification
  if (client.phone) {
    const smsBody =
      `Hi ${firstName}! ${bizName} just wrapped up your service. ` +
      `Your invoice of ${amount} is ready — view it and pay here:\n${invoiceUrl}`;

    const smsResult = await sendSMS({
      to: client.phone,
      body: smsBody,
      businessId: j.businesses!.id,
      clientId: client.id,
      metadata: { type: "invoice_notification", job_id: j.id },
    });
    results.sms = smsResult;
  }

  // Email notification
  if (client.email) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const replyTo = j.businesses?.contact_email ?? undefined;

    const emailHtml = buildInvoiceEmail({ firstName, bizName, amount, invoiceUrl, replyTo });

    const sendOpts: Parameters<typeof resend.emails.send>[0] = {
      from: `${bizName} <notifications@hustlebricks.com>`,
      to: client.email,
      subject: `Your invoice from ${bizName} — ${amount}`,
      html: emailHtml,
    };
    if (replyTo) sendOpts.replyTo = replyTo;

    const { error: emailErr } = await resend.emails.send(sendOpts);
    results.email = emailErr ? { error: emailErr.message } : { success: true };
  }

  // Mark invoice as sent
  await supabaseAdmin
    .from("jobs")
    .update({ invoice_auto_sent_at: new Date().toISOString() })
    .eq("id", j.id);

  return NextResponse.json({ success: true, ...results });
}

function buildInvoiceEmail({
  firstName,
  bizName,
  amount,
  invoiceUrl,
  replyTo,
}: {
  firstName: string;
  bizName: string;
  amount: string;
  invoiceUrl: string;
  replyTo?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;min-height:100vh">
    <tr><td align="center" style="padding:40px 16px">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">

        <tr><td align="center" style="padding-bottom:24px">
          <p style="margin:0;font-size:15px;font-weight:800;letter-spacing:0.05em;color:#6366f1;text-transform:uppercase">◆ ${bizName}</p>
        </td></tr>

        <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:linear-gradient(135deg,#6366f1 0%,#818cf8 100%);padding:36px 40px 32px">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.75)">Service complete</p>
              <h1 style="margin:0;font-size:30px;font-weight:800;color:#ffffff;line-height:1.2">Your invoice is ready</h1>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:36px 40px 28px">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#374151">Hi ${firstName},</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#374151">
                Thanks for having us out! Your service is complete and your invoice is ready to view.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
                <tr><td style="background:#f5f3ff;border-left:4px solid #6366f1;border-radius:0 12px 12px 0;padding:20px 24px">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1">Amount Due</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#1e1b4b">${amount}</p>
                </td></tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
                <tr><td align="center">
                  <a href="${invoiceUrl}" style="display:inline-block;padding:16px 40px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700">
                    View Invoice &amp; Pay →
                  </a>
                </td></tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;text-align:center">
                Or copy: <a href="${invoiceUrl}" style="color:#6366f1;text-decoration:none">${invoiceUrl}</a>
              </p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:0 40px"><hr style="border:none;border-top:1px solid #f1f5f9;margin:0"></td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:24px 40px 32px">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151">${bizName}</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af">
                ${replyTo ? `Questions? Reply to this email or reach us at <a href="mailto:${replyTo}" style="color:#6366f1;text-decoration:none">${replyTo}</a>.` : "Simply reply to this email with any questions."}
              </p>
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
