import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import ScoutButton from "./HQClient";

export const dynamic = "force-dynamic";

/* ============================================================================
   HustleBricks HQ · Platform Intelligence

   The corporate scouting deck. HustleBricks' model is micro-private-equity: the
   free OS runs thousands of micro-businesses, and HQ is where corporate watches
   which operators and salespeople are compounding fastest — so we know who to
   back. Everything on this page is computed from real tenant tables through a
   service-role client that reads across every business. No fabricated numbers.
   ============================================================================ */

const DAY = 86_400_000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type BizMetrics = {
  id: string;
  name: string;
  subscriptionStatus: string | null;
  revenue30: number;
  revenuePrev30: number;
  revenueGrowthPct: number | null; // null = no prior-period baseline
  jobsCompleted30: number;
  bookingRequests30: number;
  quotesSent30: number;
  quoteAccepted30: number;
  activeWorkers: number;
  certifiedCaps: number;
  avgCollectDays: number | null;
  crewAcceptRate: number | null;
  // sub-scores
  growth: number;
  grind: number;
  close: number;
  crew: number;
  collect: number;
  hustle: number;
};

type Salesperson = {
  memberId: string;
  name: string;
  businessName: string;
  attributedRevenue: number;
  entries: number;
  selfGenSharePct: number;
  commissionEarned: number;
};

/** Best-effort select — a missing optional table/column never sinks the board. */
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

async function computePlatform() {
  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = Date.now();
  const d30 = new Date(now - 30 * DAY).toISOString();
  const d60 = new Date(now - 60 * DAY).toISOString();

  const [
    businesses,
    paidPayments,
    jobsCompletedRecent,
    quotesRecent,
    bookingRecent,
    members,
    caps,
    crew,
    canvassing,
    commissions,
  ] = await Promise.all([
    safeSelect<{ id: string; name: string; subscription_status: string | null }>(
      svc.from("businesses").select("id, name, subscription_status").limit(10000)
    ),
    safeSelect<{
      business_id: string;
      job_id: string;
      amount: number;
      created_at: string;
      paid_at: string | null;
    }>(
      svc
        .from("payments")
        .select("business_id, job_id, amount, created_at, paid_at")
        .eq("status", "paid")
        .gte("created_at", d60)
        .limit(50000)
    ),
    safeSelect<{ business_id: string }>(
      svc
        .from("jobs")
        .select("business_id")
        .not("completed_at", "is", null)
        .gte("completed_at", d30)
        .limit(50000)
    ),
    safeSelect<{ business_id: string; status: string }>(
      svc
        .from("quotes")
        .select("business_id, status")
        .gte("created_at", d30)
        .limit(50000)
    ),
    safeSelect<{ business_id: string }>(
      svc
        .from("booking_requests")
        .select("business_id")
        .gte("created_at", d30)
        .limit(50000)
    ),
    safeSelect<{
      id: string;
      business_id: string;
      name: string;
      is_active: boolean | null;
      is_pending: boolean | null;
    }>(
      svc
        .from("team_members")
        .select("id, business_id, name, is_active, is_pending")
        .limit(50000)
    ),
    safeSelect<{ business_id: string }>(
      svc.from("member_service_capabilities").select("business_id").limit(50000)
    ),
    safeSelect<{ team_member_id: string; status: string }>(
      svc
        .from("job_crew")
        .select("team_member_id, status, responded_at")
        .in("status", ["accepted", "declined"])
        .gte("responded_at", d60)
        .limit(50000)
    ),
    safeSelect<{ business_id: string; status: string }>(
      svc.from("canvassing_properties").select("business_id, status").limit(50000)
    ),
    safeSelect<{
      member_id: string | null;
      business_id: string;
      job_total: number | null;
      amount: number;
      lead_source: string | null;
    }>(
      svc
        .from("commission_entries")
        .select("member_id, business_id, job_total, amount, lead_source")
        .limit(50000)
    ),
  ]);

  const businessName = new Map(businesses.map((b) => [b.id, b.name]));
  const memberBusiness = new Map(members.map((m) => [m.id, m.business_id]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  // ── Revenue windows (anchored on payments.created_at) ──
  const rev30 = new Map<string, number>();
  const revPrev = new Map<string, number>();
  // Earliest paid time per job → collection-speed timing.
  const payByJob = new Map<string, { biz: string; t: number }>();
  for (const p of paidPayments) {
    const created = new Date(p.created_at).getTime();
    const amt = Number(p.amount) || 0;
    if (created >= new Date(d30).getTime()) {
      rev30.set(p.business_id, (rev30.get(p.business_id) ?? 0) + amt);
    } else {
      revPrev.set(p.business_id, (revPrev.get(p.business_id) ?? 0) + amt);
    }
    const t = new Date(p.paid_at ?? p.created_at).getTime();
    const cur = payByJob.get(p.job_id);
    if (!cur || t < cur.t) payByJob.set(p.job_id, { biz: p.business_id, t });
  }

  // ── Collection speed: earliest payment vs job.completed_at ──
  const collectDays = new Map<string, number[]>();
  const jobIds = [...payByJob.keys()];
  if (jobIds.length) {
    const jobs = await safeSelect<{ id: string; completed_at: string | null }>(
      svc.from("jobs").select("id, completed_at").in("id", jobIds).limit(50000)
    );
    const completedById = new Map(jobs.map((j) => [j.id, j.completed_at]));
    for (const [jobId, { biz, t }] of payByJob) {
      const comp = completedById.get(jobId);
      if (!comp) continue;
      const days = (t - new Date(comp).getTime()) / DAY;
      if (days < 0) continue; // prepayment / bad data — ignore
      const arr = collectDays.get(biz) ?? [];
      arr.push(days);
      collectDays.set(biz, arr);
    }
  }

  // ── Simple per-business counters ──
  const jobsCompleted = new Map<string, number>();
  for (const j of jobsCompletedRecent)
    jobsCompleted.set(j.business_id, (jobsCompleted.get(j.business_id) ?? 0) + 1);

  const quotesSent = new Map<string, number>();
  const quotesAccepted = new Map<string, number>();
  for (const q of quotesRecent) {
    if (q.status !== "draft")
      quotesSent.set(q.business_id, (quotesSent.get(q.business_id) ?? 0) + 1);
    if (q.status === "accepted")
      quotesAccepted.set(q.business_id, (quotesAccepted.get(q.business_id) ?? 0) + 1);
  }

  const booking = new Map<string, number>();
  for (const b of bookingRecent)
    booking.set(b.business_id, (booking.get(b.business_id) ?? 0) + 1);

  const activeWorkers = new Map<string, number>();
  for (const m of members) {
    if (m.is_active !== false && m.is_pending !== true)
      activeWorkers.set(m.business_id, (activeWorkers.get(m.business_id) ?? 0) + 1);
  }

  const certified = new Map<string, number>();
  for (const c of caps)
    certified.set(c.business_id, (certified.get(c.business_id) ?? 0) + 1);

  // Crew reliability from job_crew responses (mapped to business via member).
  const crewAcc = new Map<string, number>();
  const crewDec = new Map<string, number>();
  for (const r of crew) {
    const biz = memberBusiness.get(r.team_member_id);
    if (!biz) continue;
    if (r.status === "accepted")
      crewAcc.set(biz, (crewAcc.get(biz) ?? 0) + 1);
    else if (r.status === "declined")
      crewDec.set(biz, (crewDec.get(biz) ?? 0) + 1);
  }

  const canvassVisited = new Map<string, number>();
  const canvassBooked = new Map<string, number>();
  for (const c of canvassing) {
    if (c.status !== "not_visited")
      canvassVisited.set(c.business_id, (canvassVisited.get(c.business_id) ?? 0) + 1);
    if (c.status === "booked")
      canvassBooked.set(c.business_id, (canvassBooked.get(c.business_id) ?? 0) + 1);
  }

  // ── Assemble scored business rows ──
  const metrics: BizMetrics[] = businesses.map((b) => {
    const r30 = rev30.get(b.id) ?? 0;
    const rPrev = revPrev.get(b.id) ?? 0;
    const jobs30 = jobsCompleted.get(b.id) ?? 0;
    const book30 = booking.get(b.id) ?? 0;
    const qSent = quotesSent.get(b.id) ?? 0;
    const qAcc = quotesAccepted.get(b.id) ?? 0;
    const workers = activeWorkers.get(b.id) ?? 0;
    const certs = certified.get(b.id) ?? 0;
    const acc = crewAcc.get(b.id) ?? 0;
    const dec = crewDec.get(b.id) ?? 0;
    const crewAcceptRate = acc + dec > 0 ? acc / (acc + dec) : null;
    const cDays = collectDays.get(b.id) ?? [];
    const avgCollectDays =
      cDays.length > 0 ? cDays.reduce((a, x) => a + x, 0) / cDays.length : null;
    const cVisited = canvassVisited.get(b.id) ?? 0;
    const cBooked = canvassBooked.get(b.id) ?? 0;

    // GROWTH
    let growth: number;
    let growthPct: number | null;
    if (rPrev === 0) {
      growth = r30 > 0 ? 75 : 0;
      growthPct = null;
    } else {
      growthPct = ((r30 - rPrev) / rPrev) * 100;
      growth = clamp(((growthPct + 50) / 150) * 100, 0, 100);
    }

    // GRIND
    const grind = clamp(jobs30 * 3 + book30 * 2 + qSent, 0, 100);

    // CLOSE
    const quoteClose = qSent > 0 ? (qAcc / qSent) * 100 : 0;
    let close = quoteClose;
    if (cVisited > 0) {
      const canvassRate = (cBooked / cVisited) * 100;
      close = (quoteClose + canvassRate) / 2;
    }
    close = clamp(close, 0, 100);

    // CREW
    const crewScore = clamp(
      clamp(workers * 15, 0, 60) +
        clamp(certs * 5, 0, 20) +
        (crewAcceptRate ?? 0.5) * 20,
      0,
      100
    );

    // COLLECT
    const collect =
      avgCollectDays === null ? 50 : clamp(100 - avgCollectDays * 7, 0, 100);

    const hustle = Math.round((growth + grind + close + crewScore + collect) / 5);

    return {
      id: b.id,
      name: b.name,
      subscriptionStatus: b.subscription_status,
      revenue30: r30,
      revenuePrev30: rPrev,
      revenueGrowthPct: growthPct,
      jobsCompleted30: jobs30,
      bookingRequests30: book30,
      quotesSent30: qSent,
      quoteAccepted30: qAcc,
      activeWorkers: workers,
      certifiedCaps: certs,
      avgCollectDays,
      crewAcceptRate,
      growth: Math.round(growth),
      grind: Math.round(grind),
      close: Math.round(close),
      crew: Math.round(crewScore),
      collect: Math.round(collect),
      hustle,
    };
  });

  metrics.sort((a, b) => b.hustle - a.hustle);

  // ── Salespeople leaderboard (cross-platform) ──
  const byMember = new Map<
    string,
    { rev: number; entries: number; selfGen: number; commission: number }
  >();
  for (const c of commissions) {
    if (!c.member_id) continue;
    const cur =
      byMember.get(c.member_id) ??
      { rev: 0, entries: 0, selfGen: 0, commission: 0 };
    cur.rev += Number(c.job_total) || 0;
    cur.entries += 1;
    cur.commission += Number(c.amount) || 0;
    if (c.lead_source === "self_generated") cur.selfGen += 1;
    byMember.set(c.member_id, cur);
  }
  const salespeople: Salesperson[] = [...byMember.entries()]
    .map(([memberId, v]) => {
      const bizId = memberBusiness.get(memberId);
      return {
        memberId,
        name: memberName.get(memberId) ?? "Unknown",
        businessName: (bizId && businessName.get(bizId)) || "—",
        attributedRevenue: v.rev,
        entries: v.entries,
        selfGenSharePct: v.entries > 0 ? (v.selfGen / v.entries) * 100 : 0,
        commissionEarned: v.commission,
      };
    })
    .sort((a, b) => b.attributedRevenue - a.attributedRevenue);

  const totals = {
    businesses: businesses.length,
    activeWorkers: [...activeWorkers.values()].reduce((a, x) => a + x, 0),
    revenue30: metrics.reduce((a, m) => a + m.revenue30, 0),
  };

  // Top ~10% (min 1) make the Acquisition Watchlist.
  const watchCount = Math.max(1, Math.ceil(metrics.length * 0.1));

  return { metrics, salespeople, totals, watchCount };
}

/* ── formatting helpers ─────────────────────────────────────────────────── */
const usd = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n)}%`;

function scoreColor(s: number) {
  if (s >= 70) return "#34d399"; // emerald
  if (s >= 45) return "#fbbf24"; // amber
  return "#f87171"; // red
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
        {label}
      </span>
      <span
        className="text-xs font-bold tabular-nums"
        style={{ color: scoreColor(value) }}
      >
        {value}
      </span>
    </div>
  );
}

export default async function HQPage() {
  // ── Access gate: authenticated email must be in HQ_ADMIN_EMAILS ──
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
  if (!email || !admins.includes(email)) redirect("/");

  const aiEnabled = !!process.env.ANTHROPIC_API_KEY;
  const { metrics, salespeople, totals, watchCount } = await computePlatform();

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Full-page dark header */}
      <header className="border-b border-white/10 bg-black/60 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined flex size-9 items-center justify-center rounded-lg text-[20px]"
              style={{ color: "#34d399", background: "rgba(52,211,153,0.12)" }}
            >
              radar
            </span>
            <div>
              <h1 className="text-sm font-bold tracking-tight">
                HustleBricks HQ · Platform Intelligence
              </h1>
              <p className="text-[11px] text-white/40">
                Micro-PE deal flow · scouting the operators worth backing
              </p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/50">
            {email}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Summary strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Businesses on platform", value: totals.businesses.toLocaleString() },
            { label: "Active workers", value: totals.activeWorkers.toLocaleString() },
            { label: "30-day platform revenue", value: usd(totals.revenue30) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                {s.label}
              </p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Business leaderboard */}
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Business Leaderboard</h2>
            <p className="text-xs text-white/40">Ranked by Hustle Score</p>
          </div>

          {metrics.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
              No businesses on the platform yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {metrics.map((m, i) => {
                const onWatchlist = i < watchCount;
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      {/* rank + score */}
                      <div className="flex items-center gap-4">
                        <span className="w-6 text-center text-lg font-bold tabular-nums text-white/40">
                          {i + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <span
                            className="text-4xl font-extrabold tabular-nums"
                            style={{ color: scoreColor(m.hustle) }}
                          >
                            {m.hustle}
                          </span>
                          <div className="w-28">
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${m.hustle}%`,
                                  background: scoreColor(m.hustle),
                                }}
                              />
                            </div>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                              Hustle Score
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* name + badges */}
                      <div className="min-w-[140px] flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{m.name}</span>
                          {onWatchlist && (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              🎯 Acquisition Watchlist
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/40">
                          {m.subscriptionStatus ?? "no plan"} ·{" "}
                          {m.activeWorkers} worker{m.activeWorkers === 1 ? "" : "s"}
                        </p>
                      </div>

                      {/* revenue */}
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums">
                          {usd(m.revenue30)}
                        </p>
                        <p
                          className="text-[11px] font-semibold"
                          style={{
                            color:
                              m.revenueGrowthPct === null
                                ? "#9ca3af"
                                : m.revenueGrowthPct >= 0
                                  ? "#34d399"
                                  : "#f87171",
                          }}
                        >
                          {m.revenueGrowthPct === null
                            ? "new"
                            : `${pct(m.revenueGrowthPct)} vs prior 30d`}
                        </p>
                      </div>
                    </div>

                    {/* sub-score chips */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Chip label="Growth" value={m.growth} />
                      <Chip label="Grind" value={m.grind} />
                      <Chip label="Close" value={m.close} />
                      <Chip label="Crew" value={m.crew} />
                      <Chip label="Collect" value={m.collect} />
                    </div>

                    {/* raw metrics */}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/40">
                      <span>{m.jobsCompleted30} jobs completed (30d)</span>
                      <span>{m.bookingRequests30} booking requests (30d)</span>
                      <span>
                        {m.quoteAccepted30}/{m.quotesSent30} quotes accepted (30d)
                      </span>
                      <span>{m.certifiedCaps} certified capabilities</span>
                      <span>
                        {m.avgCollectDays === null
                          ? "collect: n/a"
                          : `avg collect ${m.avgCollectDays.toFixed(1)}d`}
                      </span>
                      <span>
                        {m.crewAcceptRate === null
                          ? "crew accept: n/a"
                          : `crew accept ${Math.round(m.crewAcceptRate * 100)}%`}
                      </span>
                    </div>

                    <div className="mt-4">
                      <ScoutButton
                        businessId={m.id}
                        businessName={m.name}
                        aiEnabled={aiEnabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Salespeople leaderboard */}
        <section className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Salespeople Leaderboard</h2>
            <p className="text-xs text-white/40">
              Cross-platform · ranked by attributed revenue
            </p>
          </div>

          {salespeople.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
              No commission activity yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/40">
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Salesperson</th>
                    <th className="px-4 py-3 text-right font-semibold">Attributed rev</th>
                    <th className="px-4 py-3 text-right font-semibold">Deals</th>
                    <th className="px-4 py-3 text-right font-semibold">Self-gen</th>
                    <th className="px-4 py-3 text-right font-semibold">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {salespeople.map((s, i) => (
                    <tr
                      key={s.memberId}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3 tabular-nums text-white/40">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{s.name}</span>
                          {i === 0 && (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              ⭐ Top Closer
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/40">{s.businessName}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {usd(s.attributedRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/70">
                        {s.entries}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/70">
                        {Math.round(s.selfGenSharePct)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/70">
                        {usd(s.commissionEarned)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Methodology footnote — transparency is the pitch */}
        <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/40">
            How the Hustle Score is computed
          </p>
          <p className="mb-3 text-xs text-white/50">
            Score = mean of 5 sub-scores, each clamped 0–100. Windows are the last
            30 days vs. the prior 30 (day 31–60). Every input is read live from
            tenant tables — nothing is estimated.
          </p>
          <ul className="flex flex-col gap-1.5 text-xs text-white/50">
            <li>
              <b className="text-white/70">Growth</b> — clamp(((revGrowth%+50)/150)×100);
              75 if no prior revenue but revenue now; 0 if both zero.
            </li>
            <li>
              <b className="text-white/70">Grind</b> — clamp(jobsCompleted×3 +
              bookingRequests×2 + quotesSent, 0, 100).
            </li>
            <li>
              <b className="text-white/70">Close</b> — quote accept-rate %, averaged
              with canvassing booked/visited % when canvassing exists.
            </li>
            <li>
              <b className="text-white/70">Crew</b> — clamp(workers×15, 0, 60) +
              clamp(certifications×5, 0, 20) + (crewAcceptRate ?? 0.5)×20.
            </li>
            <li>
              <b className="text-white/70">Collect</b> — 50 if never paid; else
              clamp(100 − avgCollectDays×7, 0, 100).
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
