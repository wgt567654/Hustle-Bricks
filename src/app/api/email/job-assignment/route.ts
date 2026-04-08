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
    .select("id, scheduled_at, notes, total, clients(name, address, phone), businesses(name), job_line_items(description), team_members!assigned_member_id(name, email)")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const employee = (job as { team_members?: { name: string; email: string | null } }).team_members;
  if (!employee?.email) {
    return NextResponse.json({ error: "No employee email on file" }, { status: 400 });
  }

  const client = (job as { clients?: { name: string; address: string | null; phone: string | null } }).clients;
  const businessName = (job as { businesses?: { name: string | null } }).businesses?.name ?? "HustleBricks";
  const lineItems = (job as { job_line_items: { description: string }[] }).job_line_items;
  const scheduledAt = (job as { scheduled_at: string | null }).scheduled_at;

  const scheduledStr = scheduledAt
    ? new Date(scheduledAt).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "TBD";

  const serviceList = lineItems.map((li) => `<li>${li.description}</li>`).join("");
  const jobUrl = `${process.env.NEXT_PUBLIC_APP_URL}/employee/jobs/${jobId}`;

  await resend.emails.send({
    from: `${businessName} <jobs@hustlebricks.com>`,
    to: employee.email,
    subject: `New job assigned: ${scheduledStr}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="font-size:22px;font-weight:800">You've been assigned a job</h2>
        <p>Hi ${employee.name},</p>
        <p><strong>${businessName}</strong> has assigned you a new job.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666;width:120px">When</td><td style="font-weight:600">${scheduledStr}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Client</td><td style="font-weight:600">${client?.name ?? "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Address</td><td>${client?.address ?? "—"}</td></tr>
        </table>
        <p><strong>Services:</strong></p>
        <ul>${serviceList}</ul>
        <a href="${jobUrl}" style="display:inline-block;margin-top:16px;padding:14px 28px;background:#007AFF;color:white;text-decoration:none;border-radius:10px;font-weight:700">
          View Job Details
        </a>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
