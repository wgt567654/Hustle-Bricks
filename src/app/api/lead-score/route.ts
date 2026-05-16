import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

type ScoreResult = {
  score: number;
  label: "hot" | "warm" | "cool" | "cold";
  reason: string;
  actions: string[];
};

export async function POST(req: NextRequest) {
  const { leadId } = await req.json() as { leadId: string };
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch lead + verify ownership
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", lead.business_id)
    .eq("owner_id", user.id)
    .single();
  if (!biz) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  // Compute business conversion rate from recent leads
  const { data: recentLeads } = await supabase
    .from("leads")
    .select("stage")
    .eq("business_id", biz.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const total = recentLeads?.length ?? 0;
  const won = recentLeads?.filter((l) => l.stage === "won").length ?? 0;
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : null;

  // If no ANTHROPIC_API_KEY, return a rule-based fallback score
  if (!process.env.ANTHROPIC_API_KEY) {
    const result = fallbackScore(lead);
    await persistScore(supabase, leadId, result);
    return NextResponse.json(result);
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const contactParts = [
    lead.phone ? "phone ✓" : "no phone",
    lead.email ? "email ✓" : "no email",
    lead.address ? "address ✓" : "no address",
  ].join(", ");

  const prompt = `You are a lead scoring AI for ${biz.name}, a home services company.
${conversionRate !== null ? `Recent conversion rate: ${conversionRate}% of their leads become clients.` : ""}

Lead to score:
- Name: ${lead.name}
- Stage: ${lead.stage}
- Source: ${lead.source ?? "unknown"}
- Estimated job value: ${lead.estimated_value != null ? `$${lead.estimated_value}` : "not specified"}
- Contact info: ${contactParts}
- Has preferred date/time: ${lead.preferred_date ? "yes" : "no"}
- Days since created: ${daysSince}
- Notes: ${lead.notes ? `"${lead.notes.slice(0, 300)}"` : "none"}

Score this lead 0-100 on likelihood of converting to a paying client. Consider:
- Source quality (Referral/Repeat = highest, Google = medium, cold/unknown = lower)
- Contact completeness (more info = more serious)
- Estimated value and whether it's specified at all
- Scheduling intent (preferred date = high intent)
- How recent/active they are
- Any signals in the notes

Respond ONLY with valid JSON, no extra text:
{"score":75,"label":"warm","reason":"One short sentence why.","actions":["Specific action to take next","Second follow-up action"]}

Label guide: hot=75–100, warm=50–74, cool=25–49, cold=0–24`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonStr = raw.startsWith("{") ? raw : raw.slice(raw.indexOf("{"));
    const parsed = JSON.parse(jsonStr) as ScoreResult;

    const result: ScoreResult = {
      score: Math.min(100, Math.max(0, parsed.score)),
      label: parsed.label,
      reason: parsed.reason,
      actions: (parsed.actions ?? []).slice(0, 2),
    };

    await persistScore(supabase, leadId, result);
    return NextResponse.json(result);
  } catch {
    const result = fallbackScore(lead);
    await persistScore(supabase, leadId, result);
    return NextResponse.json(result);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistScore(supabase: any, leadId: string, result: ScoreResult) {
  await supabase.from("leads").update({
    ai_score: result.score,
    ai_score_label: result.label,
    ai_score_reason: result.reason,
    ai_score_actions: result.actions,
    ai_score_updated_at: new Date().toISOString(),
  }).eq("id", leadId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fallbackScore(lead: any): ScoreResult {
  let score = 30;
  if (lead.source === "Referral" || lead.source === "Repeat") score += 25;
  else if (lead.source === "Google") score += 15;
  else if (lead.source === "Door to Door") score += 10;
  if (lead.phone) score += 10;
  if (lead.email) score += 5;
  if (lead.address) score += 5;
  if (lead.estimated_value && lead.estimated_value >= 1000) score += 15;
  else if (lead.estimated_value && lead.estimated_value >= 500) score += 10;
  if (lead.preferred_date) score += 10;
  score = Math.min(100, score);

  const label: ScoreResult["label"] =
    score >= 75 ? "hot" : score >= 50 ? "warm" : score >= 25 ? "cool" : "cold";

  return {
    score,
    label,
    reason: "Scored based on source, contact completeness, and estimated value.",
    actions: [
      label === "hot" || label === "warm" ? "Follow up within 24 hours" : "Send a check-in message",
      lead.preferred_date ? "Confirm their preferred appointment time" : "Ask for their preferred date and time",
    ],
  };
}
