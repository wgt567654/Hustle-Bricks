"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserGreeting } from "@/components/UserGreeting";
import { createClient } from "@/lib/supabase/client";
import { STATUS_HEX, STATUS_CLASS, CHART_COLORS } from "@/lib/status-colors";
import { formatCurrencyRounded } from "@/lib/currency";

type TodayJob = {
  id: string;
  scheduled_at: string | null;
  status: "scheduled" | "in_progress";
  total: number;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
  team_members: { name: string } | null;
};

type NeedsAttentionItem = {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  href: string;
};

type ClockedInEntry = {
  id: string;
  clocked_in_at: string;
  team_members: { name: string } | null;
  jobs: { id: string; job_line_items: { description: string }[] } | null;
};

type SparklinePoint = { day: string; revenue: number };

type ActivityEvent = {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  timestamp: string;
};

function clockDuration(clockedInAt: string): string {
  const mins = Math.floor((Date.now() - new Date(clockedInAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function buildSparkline(
  payments: { amount: number; paid_at: string }[]
): SparklinePoint[] {
  const points: SparklinePoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
    const dayStr = d.toISOString().slice(0, 10);
    const revenue = payments
      .filter((p) => p.paid_at.slice(0, 10) === dayStr)
      .reduce((s, p) => s + p.amount, 0);
    points.push({ day: dayLabel, revenue });
  }
  return points;
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [weekRevenue, setWeekRevenue] = useState(0);
  const [todayJobCount, setTodayJobCount] = useState(0);
  const [openQuoteCount, setOpenQuoteCount] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState(0);

  const [todayJobs, setTodayJobs] = useState<TodayJob[]>([]);
  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([]);
  const [clockedIn, setClockedIn] = useState<ClockedInEntry[]>([]);
  const [sparkline, setSparkline] = useState<SparklinePoint[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, stale_quote_days")
        .eq("owner_id", user.id)
        .single();
      if (!biz) return;

      const now = new Date();

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const staleThreshold = new Date(
        now.getTime() - ((biz.stale_quote_days ?? 7) * 86400000)
      );

      const [
        { data: todayJobsData },
        { data: weekPaymentsData },
        { data: openQuotesData },
        { data: completedJobsData },
        { data: pendingBookingsData },
        { data: newLeadsData },
        { data: unreadSmsData },
        { data: stalledQuotesData },
        { data: clockedInData },
        { data: sparklinePaymentsData },
        { data: recentJobsData },
        { data: acceptedQuotesData },
      ] = await Promise.all([
        // 1. Today's scheduled + in-progress jobs
        supabase
          .from("jobs")
          .select(
            "id, scheduled_at, status, total, clients(name, address), job_line_items(description), team_members:assigned_member_id(name)"
          )
          .eq("business_id", biz.id)
          .in("status", ["scheduled", "in_progress"])
          .gte("scheduled_at", todayStart.toISOString())
          .lte("scheduled_at", todayEnd.toISOString())
          .order("scheduled_at"),

        // 2. Paid payments this week
        supabase
          .from("payments")
          .select("amount, paid_at")
          .eq("business_id", biz.id)
          .eq("status", "paid")
          .gte("paid_at", weekStart.toISOString()),

        // 3. Open quotes (draft + sent)
        supabase
          .from("quotes")
          .select("id")
          .eq("business_id", biz.id)
          .in("status", ["draft", "sent"]),

        // 4. Completed jobs (for outstanding balance)
        supabase
          .from("jobs")
          .select("id, total, payments(id)")
          .eq("business_id", biz.id)
          .eq("status", "completed"),

        // 5. Pending booking requests
        supabase
          .from("booking_requests")
          .select("id, clients(name)")
          .eq("business_id", biz.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),

        // 6. New leads
        supabase
          .from("leads")
          .select("id, name")
          .eq("business_id", biz.id)
          .eq("stage", "new")
          .limit(10),

        // 7. Unread inbound SMS
        supabase
          .from("sms_messages")
          .select("id, clients(name)")
          .eq("business_id", biz.id)
          .eq("direction", "inbound")
          .is("read_at", null),

        // 8. Stalled sent quotes
        supabase
          .from("quotes")
          .select("id, total, sent_at, clients(name)")
          .eq("business_id", biz.id)
          .eq("status", "sent")
          .not("sent_at", "is", null)
          .lt("sent_at", staleThreshold.toISOString()),

        // 9. Clocked-in employees
        supabase
          .from("time_entries")
          .select(
            "id, clocked_in_at, team_members:employee_id(name), jobs:job_id(id, job_line_items(description))"
          )
          .eq("business_id", biz.id)
          .is("clocked_out_at", null),

        // 10. Last 7 days of paid payments (sparkline)
        supabase
          .from("payments")
          .select("amount, paid_at")
          .eq("business_id", biz.id)
          .eq("status", "paid")
          .gte("paid_at", sevenDaysAgo.toISOString())
          .order("paid_at"),

        // 11. Recently completed jobs (activity)
        supabase
          .from("jobs")
          .select("id, completed_at, clients(name), job_line_items(description)")
          .eq("business_id", biz.id)
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(8),

        // 12. Recently accepted quotes (activity)
        supabase
          .from("quotes")
          .select("id, total, created_at, clients(name)")
          .eq("business_id", biz.id)
          .eq("status", "accepted")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      // --- KPIs ---
      setWeekRevenue(
        (weekPaymentsData ?? []).reduce((s, p) => s + p.amount, 0)
      );
      setTodayJobCount((todayJobsData ?? []).length);
      setOpenQuoteCount((openQuotesData ?? []).length);
      const unpaidJobs = (completedJobsData ?? []).filter(
        (j) => !(j.payments as { id: string }[])?.length
      );
      const outstanding = unpaidJobs.reduce((s, j) => s + j.total, 0);
      setOutstandingBalance(outstanding);

      // --- Today's Schedule ---
      setTodayJobs((todayJobsData ?? []) as unknown as TodayJob[]);

      // --- Needs Attention ---
      const attention: NeedsAttentionItem[] = [];

      const bookings = pendingBookingsData ?? [];
      if (bookings.length > 0) {
        const first = bookings[0] as unknown as { id: string; clients: { name: string } | null };
        attention.push({
          id: "bookings",
          icon: "calendar_clock",
          iconColor: CHART_COLORS.orange,
          title: `${bookings.length} booking request${bookings.length !== 1 ? "s" : ""} to review`,
          subtitle: first.clients?.name ?? "A client",
          href: "/bookings",
        });
      }

      const leads = newLeadsData ?? [];
      if (leads.length > 0) {
        const first = leads[0] as { id: string; name: string };
        attention.push({
          id: "leads",
          icon: "person_search",
          iconColor: CHART_COLORS.green,
          title: `${leads.length} new lead${leads.length !== 1 ? "s" : ""}`,
          subtitle: first.name,
          href: "/leads",
        });
      }

      const unread = unreadSmsData ?? [];
      if (unread.length > 0) {
        attention.push({
          id: "sms",
          icon: "chat",
          iconColor: CHART_COLORS.blue,
          title: `${unread.length} unread message${unread.length !== 1 ? "s" : ""}`,
          subtitle: "Open inbox to reply",
          href: "/inbox",
        });
      }

      const stalled = stalledQuotesData ?? [];
      if (stalled.length > 0) {
        const atRisk = stalled.reduce(
          (s, q) => s + ((q as { id: string; total: number }).total ?? 0),
          0
        );
        attention.push({
          id: "stalled",
          icon: "timer",
          iconColor: CHART_COLORS.red,
          title: `${stalled.length} stalled quote${stalled.length !== 1 ? "s" : ""}`,
          subtitle: `${formatCurrencyRounded(atRisk)} at risk`,
          href: "/sales",
        });
      }

      if (unpaidJobs.length > 0) {
        attention.push({
          id: "unpaid",
          icon: "payments",
          iconColor: CHART_COLORS.orange,
          title: `${unpaidJobs.length} unpaid job${unpaidJobs.length !== 1 ? "s" : ""}`,
          subtitle: `Collect ${formatCurrencyRounded(outstanding)}`,
          href: "/payments",
        });
      }

      setNeedsAttention(attention.slice(0, 5));

      // --- Employee Status ---
      setClockedIn((clockedInData ?? []) as unknown as ClockedInEntry[]);

      // --- Sparkline ---
      setSparkline(buildSparkline(sparklinePaymentsData ?? []));

      // --- Recent Activity ---
      const events: ActivityEvent[] = [];

      for (const job of recentJobsData ?? []) {
        const j = job as unknown as {
          id: string;
          completed_at: string;
          clients: { name: string } | null;
          job_line_items: { description: string }[];
        };
        events.push({
          id: `job-${j.id}`,
          icon: "check_circle",
          iconColor: CHART_COLORS.green,
          title: j.job_line_items[0]?.description ?? "Job completed",
          subtitle: j.clients?.name ?? "Client",
          timestamp: j.completed_at,
        });
      }

      for (const q of acceptedQuotesData ?? []) {
        const quote = q as unknown as {
          id: string;
          total: number;
          created_at: string;
          clients: { name: string } | null;
        };
        events.push({
          id: `quote-${quote.id}`,
          icon: "handshake",
          iconColor: CHART_COLORS.blue,
          title: "Quote accepted",
          subtitle: quote.clients?.name ?? "Client",
          timestamp: quote.created_at,
        });
      }

      for (const b of pendingBookingsData ?? []) {
        const booking = b as unknown as {
          id: string;
          clients: { name: string } | null;
        };
        events.push({
          id: `booking-${booking.id}`,
          icon: "calendar_clock",
          iconColor: CHART_COLORS.amber,
          title: "New booking request",
          subtitle: booking.clients?.name ?? "Client",
          timestamp: new Date().toISOString(),
        });
      }

      setActivity(
        events
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, 8)
      );

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-5 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-8">
        <div className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-8">

      {/* Section 1: Welcome + Quick Actions */}
      <div className="flex flex-col gap-3">
        <UserGreeting />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Link
            href="/jobs"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              add_circle
            </span>
            New Job
          </Link>
          <Link
            href="/quotes/new"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border font-bold text-sm active:scale-95 transition-all text-foreground"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: CHART_COLORS.blue, fontVariationSettings: "'FILL' 1" }}
            >
              request_quote
            </span>
            New Quote
          </Link>
          <Link
            href="/clients"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border font-bold text-sm active:scale-95 transition-all text-foreground"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: CHART_COLORS.green, fontVariationSettings: "'FILL' 1" }}
            >
              person_add
            </span>
            Add Client
          </Link>
          <Link
            href="/payments"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border font-bold text-sm active:scale-95 transition-all text-foreground"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: CHART_COLORS.orange, fontVariationSettings: "'FILL' 1" }}
            >
              attach_money
            </span>
            Collect Payment
          </Link>
        </div>
      </div>

      {/* Section 2: KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: CHART_COLORS.green, fontVariationSettings: "'FILL' 1" }}
            >
              payments
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              This Week
            </span>
          </div>
          <p className="text-2xl font-extrabold tracking-tight">
            {formatCurrencyRounded(weekRevenue)}
          </p>
          <p className="text-[11px] text-muted-foreground">Revenue</p>
        </Card>

        <Card className="rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: CHART_COLORS.blue, fontVariationSettings: "'FILL' 1" }}
            >
              event
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Today
            </span>
          </div>
          <p className="text-2xl font-extrabold tracking-tight">{todayJobCount}</p>
          <p className="text-[11px] text-muted-foreground">Jobs scheduled</p>
        </Card>

        <Card className="rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: CHART_COLORS.amber, fontVariationSettings: "'FILL' 1" }}
            >
              description
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Open Quotes
            </span>
          </div>
          <p className="text-2xl font-extrabold tracking-tight">{openQuoteCount}</p>
          <p className="text-[11px] text-muted-foreground">Draft + sent</p>
        </Card>

        <Card className="rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{
                color: outstandingBalance > 0 ? CHART_COLORS.orange : CHART_COLORS.green,
                fontVariationSettings: "'FILL' 1",
              }}
            >
              pending_actions
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Outstanding
            </span>
          </div>
          <p className="text-2xl font-extrabold tracking-tight">
            {outstandingBalance > 0 ? formatCurrencyRounded(outstandingBalance) : "Clear"}
          </p>
          <p className="text-[11px] text-muted-foreground">Unpaid jobs</p>
        </Card>
      </div>

      {/* Section 3: Two-column main */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Today's Schedule */}
        <Card className="lg:col-span-3 rounded-2xl p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: STATUS_HEX.scheduled, fontVariationSettings: "'FILL' 1" }}
              >
                today
              </span>
              <span className="font-bold text-sm">Today&apos;s Schedule</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {todayJobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="material-symbols-outlined text-[40px] text-muted-foreground/25">
                event_available
              </span>
              <p className="text-sm font-semibold">Nothing scheduled today</p>
              <p className="text-xs text-muted-foreground">Free day or book a new job</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {todayJobs.map((job) => {
                const time = job.scheduled_at
                  ? new Date(job.scheduled_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—";
                const description = job.job_line_items[0]?.description ?? "Job";
                return (
                  <button
                    key={job.id}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col items-center shrink-0 w-14 pt-0.5">
                      <span className="text-xs font-bold">{time}</span>
                    </div>
                    <div className="flex-1 flex flex-col min-w-0 gap-0.5">
                      <span className="text-sm font-bold truncate">{description}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {job.clients?.name ?? "Unknown client"}
                      </span>
                      {job.clients?.address && (
                        <span className="text-[11px] text-muted-foreground/70 truncate">
                          {job.clients.address}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge
                        variant="secondary"
                        className={`${STATUS_CLASS[job.status]} border-0 text-[10px]`}
                      >
                        {job.status === "in_progress" ? "In Progress" : "Scheduled"}
                      </Badge>
                      {job.team_members?.name && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {job.team_members.name}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Needs Attention */}
          <Card className="rounded-2xl p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ color: CHART_COLORS.orange, fontVariationSettings: "'FILL' 1" }}
                >
                  notifications_active
                </span>
                <span className="font-bold text-sm">Needs Attention</span>
              </div>
              {needsAttention.length > 0 && (
                <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full">
                  {needsAttention.length}
                </span>
              )}
            </div>

            {needsAttention.length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center gap-1 text-center">
                <span className="material-symbols-outlined text-[32px] text-muted-foreground/25">
                  check_circle
                </span>
                <p className="text-sm font-semibold">All caught up</p>
                <p className="text-xs text-muted-foreground">No pending actions</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {needsAttention.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.href)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ color: item.iconColor, fontVariationSettings: "'FILL' 1" }}
                      >
                        {item.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                    </div>
                    <span className="material-symbols-outlined text-muted-foreground/40 text-[15px] shrink-0">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Employee Status */}
          <Card className="rounded-2xl p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: CHART_COLORS.green, fontVariationSettings: "'FILL' 1" }}
              >
                badge
              </span>
              <span className="font-bold text-sm">Employee Status</span>
            </div>

            {clockedIn.length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center gap-1 text-center">
                <span className="material-symbols-outlined text-[32px] text-muted-foreground/25">
                  group_off
                </span>
                <p className="text-xs text-muted-foreground">No one clocked in</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {clockedIn.map((entry) => {
                  const initials = (entry.team_members?.name ?? "?")
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const jobDesc =
                    entry.jobs?.job_line_items[0]?.description ?? "No job assigned";
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-[10px] font-extrabold text-green-600">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">
                          {entry.team_members?.name ?? "Employee"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{jobDesc}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">
                        <span className="size-1.5 rounded-full bg-green-500" />
                        {clockDuration(entry.clocked_in_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Section 4: Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 7-Day Revenue Sparkline */}
        <Card className="rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: CHART_COLORS.blue, fontVariationSettings: "'FILL' 1" }}
            >
              bar_chart
            </span>
            <span className="font-bold text-sm">7-Day Revenue</span>
          </div>
          <div className="p-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sparkline}
                margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
                barSize={18}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeOpacity={0.4}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                />
                <Tooltip
                  formatter={(value) => [
                    Number(value ?? 0).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }),
                    "Revenue",
                  ]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--foreground)",
                  }}
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }}
                />
                <Bar dataKey="revenue" fill={CHART_COLORS.blue} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="rounded-2xl p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: CHART_COLORS.violet, fontVariationSettings: "'FILL' 1" }}
            >
              history
            </span>
            <span className="font-bold text-sm">Recent Activity</span>
          </div>

          {activity.length === 0 ? (
            <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-[36px] text-muted-foreground/25">
                timeline
              </span>
              <p className="text-xs text-muted-foreground">Activity will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {activity.map((event) => (
                <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 mt-0.5">
                    <span
                      className="material-symbols-outlined text-[14px]"
                      style={{ color: event.iconColor, fontVariationSettings: "'FILL' 1" }}
                    >
                      {event.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
