import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms";
import { formatCurrency } from "@/lib/currency";

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: businesses, error: bizError } = await supabaseAdmin
    .from("businesses")
    .select("id, name, currency, owner_id, contact_phone")
    .eq("morning_briefing_enabled", true);

  if (bizError) {
    console.error("[morning-briefing cron] biz query error:", bizError.message);
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  type BizRow = { id: string; name: string; currency: string | null; owner_id: string; contact_phone: string | null };

  let sent = 0;

  for (const biz of (businesses as BizRow[]) ?? []) {
    // Resolve owner's phone number
    let ownerPhone = biz.contact_phone;
    if (!ownerPhone) {
      const { data: profile } = await supabaseAdmin
        .from("team_members")
        .select("phone")
        .eq("business_id", biz.id)
        .eq("user_id", biz.owner_id)
        .maybeSingle();
      ownerPhone = (profile as { phone?: string | null } | null)?.phone ?? null;
    }
    if (!ownerPhone) continue;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const currency = biz.currency ?? "USD";

    // Today's jobs
    const { data: todayJobs } = await supabaseAdmin
      .from("jobs")
      .select("id, status, total, scheduled_at, clients(name)")
      .eq("business_id", biz.id)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .neq("status", "cancelled");

    type JobRow = { id: string; status: string; total: number; scheduled_at: string | null; clients: { name: string } | null };
    const jobs = (todayJobs as unknown as JobRow[]) ?? [];

    // Pending (sent) quotes not yet responded to
    const { count: pendingQuotes } = await supabaseAdmin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", biz.id)
      .eq("status", "sent");

    // Unpaid completed jobs
    const { data: unpaidJobs } = await supabaseAdmin
      .from("jobs")
      .select("id, total, payments(status)")
      .eq("business_id", biz.id)
      .eq("status", "completed");

    type UnpaidJobRow = { id: string; total: number; payments: { status: string }[] };
    const unpaid = ((unpaidJobs as unknown as UnpaidJobRow[]) ?? []).filter(
      (j) => !j.payments?.some((p) => p.status === "paid")
    );
    const unpaidTotal = unpaid.reduce((sum, j) => sum + (j.total ?? 0), 0);

    // New leads today
    const { count: newLeads } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", biz.id)
      .gte("created_at", todayStart.toISOString());

    // Build the briefing message
    const lines: string[] = [`☀️ Good morning! Here's your ${biz.name} briefing:`];

    if (jobs.length === 0) {
      lines.push(`📅 Jobs today: None scheduled`);
    } else {
      lines.push(`📅 Jobs today: ${jobs.length}`);
      const firstFew = jobs.slice(0, 2);
      for (const j of firstFew) {
        const time = j.scheduled_at
          ? new Date(j.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : "No time";
        const clientName = j.clients?.name ?? "Unknown";
        lines.push(`  • ${time} — ${clientName}`);
      }
      if (jobs.length > 2) lines.push(`  + ${jobs.length - 2} more`);
    }

    if ((pendingQuotes ?? 0) > 0) {
      lines.push(`📋 Quotes awaiting response: ${pendingQuotes}`);
    }

    if (unpaid.length > 0) {
      lines.push(`💰 Unpaid invoices: ${unpaid.length} (${formatCurrency(unpaidTotal, currency)} total)`);
    }

    if ((newLeads ?? 0) > 0) {
      lines.push(`🔔 New leads today: ${newLeads}`);
    }

    lines.push(`\nView dashboard: ${process.env.NEXT_PUBLIC_APP_URL}`);

    const body = lines.join("\n");

    const result = await sendSMS({
      to: ownerPhone,
      body,
      businessId: biz.id,
      metadata: { type: "morning_briefing" },
    });

    if (result.id) sent++;
  }

  console.log(`[morning-briefing cron] sent=${sent}`);
  return NextResponse.json({ sent });
}
