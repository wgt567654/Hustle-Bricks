import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { clientId } = await req.json();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, business_id, businesses(name, contact_email)")
    .eq("id", clientId)
    .single();

  type ClientData = {
    id: string;
    name: string;
    email: string | null;
    business_id: string;
    businesses?: { name: string | null; contact_email: string | null }[];
  };
  const c = client as unknown as ClientData;

  if (!c?.email) {
    return NextResponse.json({ error: "No client email on file" }, { status: 400 });
  }

  const businessName = c.businesses?.[0]?.name ?? "Your Service Provider";
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${c.id}`;

  await resend.emails.send({
    from: `${businessName} <bookings@hustlebricks.com>`,
    to: c.email,
    subject: `Book your appointment with ${businessName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="font-size:22px;font-weight:800;margin-bottom:4px">${businessName}</h2>
        <p style="color:#666;margin-bottom:24px">Appointment Booking</p>
        <p>Hi ${c.name},</p>
        <p>You're invited to book your next service appointment at a time that works for you.</p>
        <p>Click the button below to view available times and request an appointment:</p>
        <a href="${portalUrl}" style="display:inline-block;margin-top:16px;padding:14px 28px;background:#007AFF;color:white;text-decoration:none;border-radius:10px;font-weight:700">
          Book My Appointment
        </a>
        <p style="margin-top:24px;font-size:12px;color:#999">Or copy this link: ${portalUrl}</p>
        <p style="margin-top:32px;font-size:12px;color:#bbb">
          Powered by HustleBricks
        </p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
