import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { brandedEmailShell, getEmailBranding } from "@/lib/email-branding";

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, scheduled_at, client_id, business_id, clients(name, email), businesses(name, contact_email, owner_id, logo_url)")
    .eq("id", jobId)
    .single();

  type JobData = {
    scheduled_at: string | null;
    client_id: string | null;
    business_id: string | null;
    clients?: { name: string; email: string | null } | null;
    businesses?: { name: string | null; contact_email: string | null; owner_id: string | null; logo_url: string | null } | null;
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

  const branding = j.business_id
    ? await getEmailBranding(supabase, j.business_id)
    : { accentColor: "#6366f1", headerText: "", footerText: "", signature: "", socialLinks: [], disclaimer: "" };

  const html = brandedEmailShell({
    businessName,
    logoUrl: j.businesses?.logo_url,
    branding,
    subheadline,
    headline,
    bodyHtml,
    ctaHtml,
    footerNote: `You're receiving this email because you have an upcoming service scheduled with ${businessName}.`,
    replyTo,
  });

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
