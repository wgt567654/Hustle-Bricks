import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import { syncJobToCalendar } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const businessId = await getBusinessId(supabase);

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await request.json();
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const [{ data: job }, { data: business }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, status, scheduled_at, notes, clients(name, address), job_line_items(description)"
      )
      .eq("id", jobId)
      .eq("business_id", businessId)
      .single(),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .single(),
  ]);

  if (!job || !job.scheduled_at || !business) {
    return NextResponse.json({ ok: true }); // Nothing to sync
  }

  await syncJobToCalendar(
    job as Parameters<typeof syncJobToCalendar>[0],
    businessId,
    business.name
  );

  return NextResponse.json({ ok: true });
}
