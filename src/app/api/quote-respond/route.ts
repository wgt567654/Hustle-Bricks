import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { sendSMS } from "@/lib/sms";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { quoteId, action } = await req.json();

  if (!quoteId || !["accepted", "declined"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = adminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(`
      id, status, total, notes, business_id, client_id,
      clients ( id, name, phone, email ),
      businesses ( id, name, contact_phone, contact_email ),
      quote_line_items ( description, quantity, unit_price )
    `)
    .eq("id", quoteId)
    .single();

  type QuoteRow = {
    id: string;
    status: string;
    total: number;
    notes: string | null;
    business_id: string;
    client_id: string | null;
    clients: { id: string; name: string; phone: string | null; email: string | null } | null;
    businesses: { id: string; name: string | null; contact_phone: string | null; contact_email: string | null } | null;
    quote_line_items: { description: string; quantity: number; unit_price: number }[];
  };

  const q = quote as unknown as QuoteRow;

  if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (q.status !== "sent") return NextResponse.json({ error: "Quote is not awaiting a response" }, { status: 409 });

  // Mark quote as accepted/declined
  const { error } = await supabase
    .from("quotes")
    .update({ status: action })
    .eq("id", quoteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (action === "accepted") {
    await handleAccepted(supabase, q);
  }

  return NextResponse.json({ status: action });
}

async function handleAccepted(
  supabase: ReturnType<typeof adminClient>,
  q: {
    id: string;
    total: number;
    notes: string | null;
    business_id: string;
    client_id: string | null;
    clients: { id: string; name: string; phone: string | null; email: string | null } | null;
    businesses: { id: string; name: string | null; contact_phone: string | null; contact_email: string | null } | null;
    quote_line_items: { description: string; quantity: number; unit_price: number }[];
  }
) {
  const bizName = q.businesses?.name ?? "Your service provider";
  const clientName = q.clients?.name ?? "A client";
  const clientFirstName = clientName.split(" ")[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // 1. Create the job (unscheduled — client will pick a time via portal)
  const { data: newJob } = await supabase
    .from("jobs")
    .insert({
      business_id: q.business_id,
      client_id: q.client_id,
      quote_id: q.id,
      status: "scheduled",
      total: q.total,
      notes: q.notes,
    })
    .select("id")
    .single();

  // 2. Copy line items
  if (newJob?.id && q.quote_line_items.length > 0) {
    await supabase.from("job_line_items").insert(
      q.quote_line_items.map((li) => ({
        job_id: newJob.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
      }))
    );
  }

  const jobUrl = newJob?.id ? `${appUrl}/jobs/${newJob.id}` : `${appUrl}/jobs`;
  const bookingUrl = q.client_id ? `${appUrl}/portal/${q.client_id}` : null;

  // 3. Notify the owner via SMS
  if (q.businesses?.contact_phone) {
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(q.total);
    await sendSMS({
      to: q.businesses.contact_phone,
      body: `🎉 ${clientName} just accepted your quote for ${amount}! A job has been created.\nView it: ${jobUrl}`,
      businessId: q.business_id,
      metadata: { type: "quote_accepted_owner_notify", quote_id: q.id, job_id: newJob?.id },
    });
  }

  // 4. Text the client a confirmation + booking link
  if (q.clients?.phone) {
    const smsBody = bookingUrl
      ? `Hi ${clientFirstName}! Your quote with ${bizName} has been accepted — we're excited to get you scheduled! Pick a time that works for you here:\n${bookingUrl}`
      : `Hi ${clientFirstName}! Your quote with ${bizName} has been accepted! We'll reach out shortly to schedule your service.`;

    await sendSMS({
      to: q.clients.phone,
      body: smsBody,
      businessId: q.business_id,
      clientId: q.clients.id,
      metadata: { type: "quote_accepted_client_notify", quote_id: q.id },
    });
  }

  // 5. Email the client a booking link
  if (q.clients?.email && bookingUrl) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const replyTo = q.businesses?.contact_email ?? undefined;

    const sendOpts: Parameters<typeof resend.emails.send>[0] = {
      from: `${bizName} <notifications@hustlebricks.com>`,
      to: q.clients.email,
      subject: `Your quote is approved — let's get you scheduled!`,
      html: buildBookingEmail({ firstName: clientFirstName, bizName, bookingUrl, replyTo }),
    };
    if (replyTo) sendOpts.replyTo = replyTo;

    await resend.emails.send(sendOpts).catch(() => {});
  }
}

function buildBookingEmail({
  firstName,
  bizName,
  bookingUrl,
  replyTo,
}: {
  firstName: string;
  bizName: string;
  bookingUrl: string;
  replyTo?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
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
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.75)">Quote approved</p>
              <h1 style="margin:0;font-size:30px;font-weight:800;color:#ffffff;line-height:1.2">Let's get you scheduled!</h1>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:36px 40px 28px">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#374151">Hi ${firstName},</p>
              <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#374151">
                Great news — your quote has been approved and we&apos;re ready to get started! Click below to view available times and pick the slot that works best for you.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
                <tr><td align="center">
                  <a href="${bookingUrl}" style="display:inline-block;padding:16px 40px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700">
                    Pick My Appointment Time →
                  </a>
                </td></tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;text-align:center">
                Or copy: <a href="${bookingUrl}" style="color:#6366f1;text-decoration:none">${bookingUrl}</a>
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
                ${replyTo ? `Questions? Reply or reach us at <a href="mailto:${replyTo}" style="color:#6366f1;text-decoration:none">${replyTo}</a>.` : "Simply reply to this email with any questions."}
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
