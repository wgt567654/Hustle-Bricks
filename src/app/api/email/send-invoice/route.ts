import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, scheduled_at, client_id, clients(name, email), businesses(name, contact_email, owner_id)")
    .eq("id", jobId)
    .single();

  type JobData = {
    scheduled_at: string | null;
    client_id: string | null;
    clients?: { name: string; email: string | null } | null;
    businesses?: { name: string | null; contact_email: string | null; owner_id: string | null } | null;
  };
  const j = job as unknown as JobData;
  const client = j.clients;
  if (!job || !client?.email) {
    return NextResponse.json({ error: "No client email on file" }, { status: 400 });
  }

  const businessName = j.businesses?.name ?? "Your service provider";
  const replyTo = j.businesses?.contact_email ?? undefined;

  const bookingUrl = j.client_id
    ? `${process.env.NEXT_PUBLIC_APP_URL}/portal/${j.client_id}`
    : null;

  let subject: string;
  let headline: string;
  let subheadline: string;
  let bodyHtml: string;
  let ctaHtml: string;

  if (j.scheduled_at) {
    const d = new Date(j.scheduled_at);
    const date = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    subject = `Your appointment is confirmed ✓`;
    headline = "You're all booked!";
    subheadline = `Appointment confirmed with ${businessName}`;
    bodyHtml = `
      <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#374151">
        Hi ${client.name},
      </p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#374151">
        Great news — you're officially on the schedule. Here are your appointment details:
      </p>
      <!-- Appointment card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
        <tr><td style="background:#f5f3ff;border-left:4px solid #6366f1;border-radius:0 12px 12px 0;padding:20px 24px">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1">Date &amp; Time</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#1e1b4b">${date}</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#4338ca">${time}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.7;color:#374151">
        If anything comes up or you have questions before your appointment, just reply to this email — we're happy to help.
      </p>
      <p style="margin:0;font-size:16px;line-height:1.7;color:#374151">
        Otherwise, we'll see you soon!
      </p>
    `;
    ctaHtml = "";
  } else {
    subject = `Book your appointment with ${businessName}`;
    headline = "Let's get you scheduled";
    subheadline = `Pick a time that works for you`;
    bodyHtml = `
      <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#374151">
        Hi ${client.name},
      </p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#374151">
        Thanks for confirming your quote with us! We're excited to get your service taken care of. Click below to view available times and pick the slot that works best for you.
      </p>
    `;
    ctaHtml = bookingUrl ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
        <tr><td align="center">
          <a href="${bookingUrl}" style="display:inline-block;padding:16px 40px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.01em">
            Book My Appointment →
          </a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;text-align:center">
        Or copy this link: <a href="${bookingUrl}" style="color:#6366f1;text-decoration:none">${bookingUrl}</a>
      </p>
    ` : "";
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;min-height:100vh">
    <tr><td align="center" style="padding:40px 16px">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">

        <!-- Top logo bar -->
        <tr><td align="center" style="padding-bottom:24px">
          <p style="margin:0;font-size:15px;font-weight:800;letter-spacing:0.05em;color:#6366f1;text-transform:uppercase">
            ◆ ${businessName}
          </p>
        </td></tr>

        <!-- Main card -->
        <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

          <!-- Hero header -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:linear-gradient(135deg,#6366f1 0%,#818cf8 100%);padding:36px 40px 32px">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${subheadline}</p>
              <h1 style="margin:0;font-size:30px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.02em">${headline}</h1>
            </td></tr>
          </table>

          <!-- Body content -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:36px 40px 28px">
              ${bodyHtml}
              ${ctaHtml}
            </td></tr>
          </table>

          <!-- Divider -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:0 40px"><hr style="border:none;border-top:1px solid #f1f5f9;margin:0"></td></tr>
          </table>

          <!-- Footer -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:24px 40px 32px">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151">${businessName}</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af">
                You're receiving this email because you have an upcoming service scheduled with ${businessName}.
                ${replyTo ? `Reply to this email or contact us at <a href="mailto:${replyTo}" style="color:#6366f1;text-decoration:none">${replyTo}</a>.` : "Simply reply to this email to reach us."}
              </p>
            </td></tr>
          </table>

        </td></tr>

        <!-- Bottom powered-by -->
        <tr><td align="center" style="padding-top:20px">
          <p style="margin:0;font-size:11px;color:#cbd5e1">Powered by <strong style="color:#94a3b8">HustleBricks</strong></p>
        </td></tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;

  const sendOptions: Parameters<typeof resend.emails.send>[0] = {
    from: `${businessName} <notifications@hustlebricks.com>`,
    to: client.email,
    subject,
    html,
  };
  if (replyTo) sendOptions.replyTo = replyTo;

  const { error: sendError } = await resend.emails.send(sendOptions);

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
