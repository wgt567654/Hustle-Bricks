import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

async function safeSelect<T = Record<string, unknown>>(
  q: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const { data } = await q;
    return data ?? [];
  } catch {
    return [];
  }
}

/** Recompute one business's metrics + Hustle Score (mirrors /hq). */
async function computeOne(businessId: string) {
  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = Date.now();
  const d30 = new Date(now - 30 * DAY).toISOString();
  const d60 = new Date(now - 60 * DAY).toISOString();

  const [biz] = await safeSelect<{
    id: string;
    name: string;
    subscription_status: string | null;
  }>(
    svc
      .from("businesses")
      .select("id, name, subscription_status")
      .eq("id", businessId)
      .limit(1)
  );
  if (!biz) return null;

  const [
    paidPayments,
    jobsCompletedRecent,
    quotesRecent,
    bookingRecent,
    members,
    caps,
    crew,
    canvassing,
  ] = await Promise.all([
    safeSelect<{
      job_id: string;
      amount: number;
      created_at: string;
      paid_at: string | null;
    }>(
      svc
        .from("payments")
        .select("job_id, amount, created_at, paid_at")
        .eq("business_id", businessId)
        .eq("status", "paid")
        .gte("created_at", d60)
        .limit(50000)
    ),
    safeSelect<{ id: string }>(
      svc
        .from("jobs")
        .select("id")
        .eq("business_id", businessId)
        .not("completed_at", "is", null)
        .gte("completed_at", d30)
        .limit(50000)
    ),
    safeSelect<{ status: string }>(
      svc
        .from("quotes")
        .select("status")
        .eq("business_id", businessId)
        .gte("created_at", d30)
        .limit(50000)
    ),
    safeSelect<{ id: string }>(
      svc
        .from("booking_requests")
        .select("id")
        .eq("business_id", businessId)
        .gte("created_at", d30)
        .limit(50000)
    ),
    safeSelect<{ id: string; is_active: boolean | null; is_pending: boolean | null }>(
      svc
        .from("team_members")
        .select("id, is_active, is_pending")
        .eq("business_id", businessId)
        .limit(50000)
    ),
    safeSelect<{ id: string }>(
      svc
        .from("member_service_capabilities")
        .select("id")
        .eq("business_id", businessId)
        .limit(50000)
    ),
    safeSelect<{ team_member_id: string; status: string }>(
      svc
        .from("job_crew")
        .select("team_member_id, status, responded_at")
        .in("status", ["accepted", "declined"])
        .gte("responded_at", d60)
        .limit(50000)
    ),
    safeSelect<{ status: string }>(
      svc
        .from("canvassing_properties")
        .select("status")
        .eq("business_id", businessId)
        .limit(50000)
    ),
  ]);

  const memberIds = new Set(members.map((m) => m.id));

  // Revenue windows + earliest-paid-per-job.
  let rev30 = 0;
  let revPrev = 0;
  const payByJob = new Map<string, number>();
  const d30ms = new Date(d30).getTime();
  for (const p of paidPayments) {
    const created = new Date(p.created_at).getTime();
    const amt = Number(p.amount) || 0;
    if (created >= d30ms) rev30 += amt;
    else revPrev += amt;
    const t = new Date(p.paid_at ?? p.created_at).getTime();
    const cur = payByJob.get(p.job_id);
    if (cur === undefined || t < cur) payByJob.set(p.job_id, t);
  }

  // Collection speed.
  let avgCollectDays: number | null = null;
  const jobIds = [...payByJob.keys()];
  if (jobIds.length) {
    const jobs = await safeSelect<{ id: string; completed_at: string | null }>(
      svc.from("jobs").select("id, completed_at").in("id", jobIds).limit(50000)
    );
    const completedById = new Map(jobs.map((j) => [j.id, j.completed_at]));
    const days: number[] = [];
    for (const [jobId, t] of payByJob) {
      const comp = completedById.get(jobId);
      if (!comp) continue;
      const d = (t - new Date(comp).getTime()) / DAY;
      if (d >= 0) days.push(d);
    }
    if (days.length) avgCollectDays = days.reduce((a, x) => a + x, 0) / days.length;
  }

  const jobsCompleted30 = jobsCompletedRecent.length;
  const bookingRequests30 = bookingRecent.length;
  const quotesSent30 = quotesRecent.filter((q) => q.status !== "draft").length;
  const quoteAccepted30 = quotesRecent.filter((q) => q.status === "accepted").length;
  const activeWorkers = members.filter(
    (m) => m.is_active !== false && m.is_pending !== true
  ).length;
  const certifiedCaps = caps.length;

  let acc = 0;
  let dec = 0;
  for (const r of crew) {
    if (!memberIds.has(r.team_member_id)) continue;
    if (r.status === "accepted") acc++;
    else if (r.status === "declined") dec++;
  }
  const crewAcceptRate = acc + dec > 0 ? acc / (acc + dec) : null;

  const cVisited = canvassing.filter((c) => c.status !== "not_visited").length;
  const cBooked = canvassing.filter((c) => c.status === "booked").length;

  // ── Sub-scores ──
  let growth: number;
  let growthPct: number | null;
  if (revPrev === 0) {
    growth = rev30 > 0 ? 75 : 0;
    growthPct = null;
  } else {
    growthPct = ((rev30 - revPrev) / revPrev) * 100;
    growth = clamp(((growthPct + 50) / 150) * 100, 0, 100);
  }
  const grind = clamp(jobsCompleted30 * 3 + bookingRequests30 * 2 + quotesSent30, 0, 100);
  const quoteClose = quotesSent30 > 0 ? (quoteAccepted30 / quotesSent30) * 100 : 0;
  let close = quoteClose;
  if (cVisited > 0) close = (quoteClose + (cBooked / cVisited) * 100) / 2;
  close = clamp(close, 0, 100);
  const crewScore = clamp(
    clamp(activeWorkers * 15, 0, 60) +
      clamp(certifiedCaps * 5, 0, 20) +
      (crewAcceptRate ?? 0.5) * 20,
    0,
    100
  );
  const collect =
    avgCollectDays === null ? 50 : clamp(100 - avgCollectDays * 7, 0, 100);
  const hustle = Math.round((growth + grind + close + crewScore + collect) / 5);

  return {
    name: biz.name,
    subscriptionStatus: biz.subscription_status,
    revenue30: Math.round(rev30),
    revenuePrev30: Math.round(revPrev),
    revenueGrowthPct: growthPct === null ? null : Math.round(growthPct),
    jobsCompleted30,
    bookingRequests30,
    quotesSent30,
    quoteAccepted30,
    activeWorkers,
    certifiedCaps,
    avgCollectDays: avgCollectDays === null ? null : Number(avgCollectDays.toFixed(1)),
    crewAcceptRate:
      crewAcceptRate === null ? null : Math.round(crewAcceptRate * 100),
    scores: {
      growth: Math.round(growth),
      grind: Math.round(grind),
      close: Math.round(close),
      crew: Math.round(crewScore),
      collect: Math.round(collect),
      hustle,
    },
  };
}

export async function POST(request: NextRequest) {
  // ── Same email gate as /hq ──
  const admins = (process.env.HQ_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  let email = (claimsData?.claims?.email ?? "").toString().toLowerCase().trim();
  if (!email) {
    const { data: userData } = await supabase.auth.getUser();
    email = (userData?.user?.email ?? "").toLowerCase().trim();
  }
  if (!email || !admins.includes(email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI scouting not configured" });
  }

  let businessId: string | undefined;
  try {
    const body = await request.json();
    businessId = body?.businessId;
  } catch {
    // fall through to validation below
  }
  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const m = await computeOne(businessId);
  if (!m) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const prompt = `You are a scout for HustleBricks Capital, a micro-private-equity firm. HustleBricks runs a free operating system for micro-businesses (detailing, lawn care, pressure washing, etc.) and uses the data to find operators worth acquiring or backing. Evaluate this operator from its live platform metrics and write a tight scouting memo.

BUSINESS: ${m.name}
Subscription status: ${m.subscriptionStatus ?? "none"}
Hustle Score: ${m.scores.hustle}/100 (Growth ${m.scores.growth}, Grind ${m.scores.grind}, Close ${m.scores.close}, Crew ${m.scores.crew}, Collect ${m.scores.collect})

Last 30 days:
- Revenue: $${m.revenue30} (prior 30d: $${m.revenuePrev30}${m.revenueGrowthPct === null ? "; no prior baseline" : `; ${m.revenueGrowthPct >= 0 ? "+" : ""}${m.revenueGrowthPct}% growth`})
- Jobs completed: ${m.jobsCompleted30}
- Booking requests: ${m.bookingRequests30}
- Quotes: ${m.quoteAccepted30} accepted of ${m.quotesSent30} sent
- Active workers: ${m.activeWorkers}; certified capabilities: ${m.certifiedCaps}
- Avg collection time: ${m.avgCollectDays === null ? "n/a" : m.avgCollectDays + " days"}
- Crew accept rate: ${m.crewAcceptRate === null ? "n/a" : m.crewAcceptRate + "%"}

Write four short sections with these exact headers: STRENGTHS, RISKS, TRAJECTORY. Keep each to 2-3 sentences. Then a final line exactly in this format:
VERDICT: WATCH|PURSUE|PASS — one line reason`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "AI scouting request failed" },
        { status: 502 }
      );
    }

    const json = await res.json();
    const report: string =
      Array.isArray(json?.content)
        ? json.content
            .map((c: { type?: string; text?: string }) =>
              c?.type === "text" ? c.text : ""
            )
            .join("")
            .trim()
        : "";

    if (!report) {
      return NextResponse.json(
        { error: "AI returned an empty report" },
        { status: 502 }
      );
    }

    return NextResponse.json({ report });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the scouting engine" },
      { status: 502 }
    );
  }
}
