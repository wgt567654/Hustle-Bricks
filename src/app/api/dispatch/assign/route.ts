import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { findBestMember } from "@/lib/dispatch";
import { sendSMS } from "@/lib/sms";

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
      id, scheduled_at, duration_mins, business_id, assigned_member_id, total,
      clients ( name, address, phone ),
      businesses ( name, contact_email ),
      job_line_items ( description )
    `)
    .eq("id", jobId)
    .single();

  type JobRow = {
    id: string;
    scheduled_at: string | null;
    duration_mins: number | null;
    business_id: string;
    assigned_member_id: string | null;
    total: number;
    clients: { name: string; address: string | null; phone: string | null } | null;
    businesses: { name: string | null; contact_email: string | null } | null;
    job_line_items: { description: string }[];
  };

  const j = job as unknown as JobRow;

  if (!j) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!j.scheduled_at) return NextResponse.json({ assigned: null, reason: "no_scheduled_at" });
  if (j.assigned_member_id) return NextResponse.json({ assigned: j.assigned_member_id, reason: "already_assigned" });

  const match = await findBestMember({
    businessId: j.business_id,
    scheduledAt: j.scheduled_at,
    durationMins: j.duration_mins ?? 60,
    excludeJobId: j.id,
  });

  if (!match) return NextResponse.json({ assigned: null, reason: "no_available_member" });

  // Assign the member
  await supabaseAdmin
    .from("jobs")
    .update({ assigned_member_id: match.memberId })
    .eq("id", j.id);

  const bizName = j.businesses?.name ?? "Your employer";
  const scheduledStr = new Date(j.scheduled_at).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const jobUrl = `${process.env.NEXT_PUBLIC_APP_URL}/employee/jobs/${j.id}`;
  const clientName = j.clients?.name ?? "a client";
  const address = j.clients?.address ?? "";

  // Email the team member
  if (match.memberEmail) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const serviceList = j.job_line_items.map((li) => `<li>${li.description}</li>`).join("");
    await resend.emails.send({
      from: `${bizName} <jobs@hustlebricks.com>`,
      to: match.memberEmail,
      subject: `New job assigned: ${scheduledStr}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
          <h2 style="font-size:22px;font-weight:800">You've been assigned a job</h2>
          <p>Hi ${match.memberName},</p>
          <p><strong>${bizName}</strong> has assigned you a new job.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#666;width:120px">When</td><td style="font-weight:600">${scheduledStr}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Client</td><td style="font-weight:600">${clientName}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Address</td><td>${address}</td></tr>
          </table>
          ${serviceList ? `<p><strong>Services:</strong></p><ul>${serviceList}</ul>` : ""}
          <a href="${jobUrl}" style="display:inline-block;margin-top:16px;padding:14px 28px;background:#6366f1;color:white;text-decoration:none;border-radius:10px;font-weight:700">
            View Job Details →
          </a>
        </div>
      `,
    }).catch(() => {});
  }

  // SMS the team member
  if (match.memberPhone) {
    await sendSMS({
      to: match.memberPhone,
      body: `Hi ${match.memberName}! You've been assigned a new job on ${scheduledStr}${address ? ` at ${address}` : ""}. View details: ${jobUrl}`,
      businessId: j.business_id,
      metadata: { type: "job_assignment", job_id: j.id },
    });
  }

  return NextResponse.json({ assigned: match.memberId, memberName: match.memberName });
}
