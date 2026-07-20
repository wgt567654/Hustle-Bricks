import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyOwner } from "@/lib/notify-owner";

type JobRow = {
  business_id: string;
  scheduled_at: string | null;
  clients: { name: string } | { name: string }[] | null;
};

export async function POST(req: NextRequest) {
  try {
    // Caller's session + RLS (worker may UPDATE only their own job_crew row)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId, status } = await req.json();
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
    if (status !== "accepted" && status !== "declined") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Load the job (RLS hides jobs the caller can't see → treat as not found)
    const { data: jobData } = await supabase
      .from("jobs")
      .select("business_id, scheduled_at, clients(name)")
      .eq("id", jobId)
      .single();
    if (!jobData) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const job = jobData as unknown as JobRow;

    // Resolve the caller's team_member for this business
    const { data: member } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("business_id", job.business_id)
      .single();
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Record consent on their crew row
    const { data: updated, error: updateError } = await supabase
      .from("job_crew")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .eq("team_member_id", member.id)
      .select("team_member_id");
    if (updateError || !updated || updated.length === 0) {
      return NextResponse.json({ error: "You are not on this job's crew." }, { status: 400 });
    }

    // Notify the owner only when someone declines (best-effort, never throws)
    if (status === "declined") {
      const clientRel = job.clients;
      const clientName = Array.isArray(clientRel)
        ? clientRel[0]?.name ?? "a client"
        : clientRel?.name ?? "a client";
      const when = job.scheduled_at
        ? new Date(job.scheduled_at).toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null;
      const text = when
        ? `${member.name} declined the job for ${clientName} on ${when}. Reassign in HustleBricks.`
        : `${member.name} declined the job for ${clientName}. Reassign in HustleBricks.`;
      await notifyOwner({
        businessId: job.business_id,
        subject: "Crew declined a job",
        text,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
