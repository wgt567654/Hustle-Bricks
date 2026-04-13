import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/currency";

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, total, scheduled_at, clients(name, email), businesses(name, currency, contact_email)")
    .eq("id", jobId)
    .single();

  type JobData = {
    total: number;
    clients?: { name: string; email: string | null }[];
    businesses?: { name: string | null; currency: string | null; contact_email: string | null }[];
  };
  const j = job as unknown as JobData;
  const client = j.clients?.[0];
  if (!job || !client?.email) {
    return NextResponse.json({ error: "No client email on file" }, { status: 400 });
  }

  const businessName = j.businesses?.[0]?.name ?? "HustleBricks";
  const currency = j.businesses?.[0]?.currency ?? "USD";
  const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${jobId}`;
  const refNum = `#JB-${jobId.slice(0, 6).toUpperCase()}`;

  await resend.emails.send({
    from: `${businessName} <invoices@hustlebricks.com>`,
    to: client.email,
    subject: `Your invoice ${refNum} from ${businessName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="font-size:22px;font-weight:800;margin-bottom:4px">${businessName}</h2>
        <p style="color:#666;margin-bottom:24px">Invoice ${refNum}</p>
        <p>Hi ${client.name},</p>
        <p>Your invoice for <strong>${formatCurrency(j.total, currency)}</strong> is ready to view and pay online.</p>
        <a href="${invoiceUrl}" style="display:inline-block;margin-top:16px;padding:14px 28px;background:#007AFF;color:white;text-decoration:none;border-radius:10px;font-weight:700">
          View Invoice &amp; Pay
        </a>
        <p style="margin-top:24px;font-size:12px;color:#999">Or copy this link: ${invoiceUrl}</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
