import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export type UpsellSuggestion = {
  title: string;
  pitch: string;
  icon: string;
};

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }

  const supabase = await createClient();

  // Verify the requester owns this job's business
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, business_id, client_id, service_type, job_line_items(description), clients(name)")
    .eq("id", jobId)
    .single();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Verify ownership (owner OR employee of this business)
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", job.business_id)
    .single();
  if (!biz) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  // Gather context in parallel
  const [{ data: history }, { data: catalog }] = await Promise.all([
    supabase
      .from("jobs")
      .select("job_line_items(description)")
      .eq("client_id", job.client_id)
      .eq("status", "completed")
      .neq("id", jobId)
      .order("completed_at", { ascending: false })
      .limit(5),
    supabase
      .from("services")
      .select("name, description")
      .eq("business_id", job.business_id)
      .eq("is_active", true)
      .order("name")
      .limit(30),
  ]);

  const performed = (job.job_line_items as { description: string }[])
    .map((li) => li.description).join(", ");

  const pastServices = (history ?? [])
    .flatMap((j) => (j.job_line_items as { description: string }[]).map((li) => li.description))
    .filter(Boolean)
    .slice(0, 10)
    .join(", ") || "none on record";

  const menuItems = (catalog ?? [])
    .map((s) => s.name + (s.description ? ` (${s.description})` : ""))
    .join(", ") || "general home services";

  const clientName = (job.clients as unknown as { name: string } | null)?.name ?? "the client";

  const prompt = `You are a business coach for ${biz.name}, a home services company.

A job for ${clientName} was just completed.
Services performed today: ${performed}
Client's previous services with us: ${pastServices}
Our service menu: ${menuItems}

Suggest exactly 2–3 follow-up services to pitch to ${clientName} next. Each should be directly relevant to what was done or commonly needed after these services. Be specific and practical — skip generic advice.

Respond with ONLY valid JSON in this exact shape:
{"suggestions":[{"title":"Service Name","pitch":"One sentence explaining why this is the perfect next step for this client right now.","icon":"one_of: cleaning|yard|build|water_drop|pest_control|home_repair_service|grass|roofing|solar_power|heat_pump"}]}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonStr = raw.startsWith("{") ? raw : raw.slice(raw.indexOf("{"));
    const parsed = JSON.parse(jsonStr) as { suggestions: UpsellSuggestion[] };
    return NextResponse.json({ suggestions: parsed.suggestions.slice(0, 3) });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
