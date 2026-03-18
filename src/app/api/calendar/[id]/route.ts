import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Job = {
  id: string;
  status: string;
  total: number;
  scheduled_at: string | null;
  notes: string | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
};

function generateICS(jobs: Job[], businessName: string) {
  const escape = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

  const events = jobs
    .filter((j) => j.scheduled_at)
    .map((j) => {
      const start = new Date(j.scheduled_at!);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const title = j.job_line_items[0]?.description ?? "Service Job";
      const client = j.clients?.name ?? "";
      const location = j.clients?.address ?? "";
      const fmt = (d: Date) =>
        d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      return [
        "BEGIN:VEVENT",
        `UID:${j.id}@hustlebricks`,
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${escape(`${title}${client ? ` — ${client}` : ""}`)}`,
        location ? `LOCATION:${escape(location)}` : null,
        j.notes ? `DESCRIPTION:${escape(j.notes)}` : null,
        `STATUS:${j.status === "completed" ? "COMPLETED" : "CONFIRMED"}`,
        `LAST-MODIFIED:${fmt(new Date())}`,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HustleBricks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${businessName} — HustleBricks`,
    "X-WR-TIMEZONE:UTC",
    events,
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, status, total, scheduled_at, notes, clients(name, address), job_line_items(description)"
    )
    .eq("business_id", id)
    .not("scheduled_at", "is", null)
    .order("scheduled_at");

  const ics = generateICS((jobs as unknown as Job[]) ?? [], business.name);

  const filename = `${business.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-schedule.ics`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
