"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { STATUS_HEX, STATUS_CLASS } from "@/lib/status-colors";
import { formatCurrency, formatCurrencyRounded } from "@/lib/currency";
import { getDefaultTemplate, interpolateTemplate } from "@/lib/messageTemplates";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
  job_crew: { team_member_id: string }[];
};

type CrewMember = { id: string; name: string };

type TomorrowJob = {
  id: string;
  scheduled_at: string;
  service_type: string | null;
  clients: { name: string; phone: string | null } | null;
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}


function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function formatScheduled(dateStr: string | null) {
  if (!dateStr) return "Unscheduled";
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return `Today ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildReminderSms(
  clientName: string,
  ownerFirstName: string,
  bizName: string,
  scheduledAt: string,
  serviceType: string | null,
  savedTemplates: Record<string, string>,
) {
  const d = new Date(scheduledAt);
  const date = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const ownerName = ownerFirstName || bizName;
  const svcType = serviceType ?? "Other";
  const templateBody = savedTemplates[svcType] ?? getDefaultTemplate(svcType, "reminder");
  return interpolateTemplate(templateBody, { clientName, ownerName, bizName, date, time });
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [allPayments, setAllPayments] = useState<{ amount: number; paid_at: string }[]>([]);
  const [revenueFilter, setRevenueFilter] = useState<"today" | "week" | "month" | "year">("week");
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [outstandingCount, setOutstandingCount] = useState(0);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [smsReminders, setSmsReminders] = useState(false);
  const [tomorrowJobs, setTomorrowJobs] = useState<TomorrowJob[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [reminderTemplates, setReminderTemplates] = useState<Record<string, string>>({});
  const [selectedCrewMember, setSelectedCrewMember] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [teamMembers, setTeamMembers] = useState<CrewMember[]>([]);
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "tomorrow" | "this_week" | "next_week" | "next_month" | "custom">("all");
  const [showCrewPanel, setShowCrewPanel] = useState(false);
  const [crewSearch, setCrewSearch] = useState("");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const crewDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCrewPanel) return;
    function handleOutside(e: MouseEvent) {
      if (crewDropdownRef.current && !crewDropdownRef.current.contains(e.target as Node)) {
        setShowCrewPanel(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showCrewPanel]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fullName: string = user.user_metadata?.full_name ?? user.email ?? "";
      setFirstName(fullName.split(" ")[0] || "");

      const { data: biz } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!biz) return;
      const businessId = biz.id;
      setCurrency((biz as unknown as { currency: string }).currency ?? "USD");
      setSmsReminders((biz as unknown as { sms_reminders_enabled: boolean }).sms_reminders_enabled ?? false);
      setBusinessName((biz as unknown as { name: string }).name ?? "");

      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 1, 0, 1);

      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const tomorrowStart = new Date(tomorrow);
      tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);

      const [{ data }, { data: weekPayments }, { data: completedJobs }, { data: tomorrowData }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, completed_at, created_at, notes, clients(name, address), job_line_items(description), job_crew(team_member_id)")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
        supabase.from("payments").select("amount, paid_at").eq("business_id", businessId)
          .eq("status", "paid").gte("paid_at", twoYearsAgo.toISOString()),
        supabase.from("jobs").select("id, total, payments(id)")
          .eq("business_id", businessId).eq("status", "completed"),
        supabase
          .from("jobs")
          .select("id, scheduled_at, service_type, clients(name, phone)")
          .eq("business_id", businessId)
          .eq("status", "scheduled")
          .gte("scheduled_at", tomorrowStart.toISOString())
          .lte("scheduled_at", tomorrowEnd.toISOString())
          .order("scheduled_at"),
      ]);

      const { data: tmplData } = await supabase
        .from("message_templates")
        .select("service_type, body")
        .eq("business_id", businessId)
        .eq("message_type", "reminder");
      const saved: Record<string, string> = {};
      (tmplData ?? []).forEach((r: { service_type: string; body: string }) => { saved[r.service_type] = r.body; });
      setReminderTemplates(saved);

      const jobList = (data as unknown as Job[]) ?? [];
      setJobs(jobList);
      setTomorrowJobs((tomorrowData as unknown as TomorrowJob[]) ?? []);

      const { data: teamMembersData } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("name");
      const assignedIds = new Set(jobList.flatMap((j) => j.job_crew.map((c) => c.team_member_id)));
      setTeamMembers((teamMembersData ?? []).filter((m: CrewMember) => assignedIds.has(m.id)));

      setAllPayments((weekPayments as unknown as { amount: number; paid_at: string }[]) ?? []);
      const unpaid = (completedJobs ?? []).filter(
        (j: { payments: { id: string }[] }) => !j.payments || j.payments.length === 0
      );
      setOutstandingCount(unpaid.length);
      setOutstandingAmount((unpaid as { total: number }[]).reduce((s, j) => s + j.total, 0));
      setStatsLoaded(true);

      setLoading(false);
    }
    load();
  }, []);

  // Revenue period stats
  function getRevenueDateBounds(period: "today" | "week" | "month" | "year") {
    const now = new Date();
    if (period === "today") {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      const ps = new Date(s); ps.setDate(s.getDate() - 1);
      const pe = new Date(e); pe.setDate(e.getDate() - 1);
      return { curStart: s, curEnd: e, priorStart: ps, priorEnd: pe };
    }
    if (period === "week") {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      const ps = new Date(s); ps.setDate(s.getDate() - 7);
      const pe = new Date(s); pe.setMilliseconds(-1);
      return { curStart: s, curEnd: e, priorStart: ps, priorEnd: pe };
    }
    if (period === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      const ps = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const pe = new Date(s); pe.setMilliseconds(-1);
      return { curStart: s, curEnd: e, priorStart: ps, priorEnd: pe };
    }
    const s = new Date(now.getFullYear(), 0, 1);
    const e = new Date(now); e.setHours(23, 59, 59, 999);
    const ps = new Date(now.getFullYear() - 1, 0, 1);
    const pe = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { curStart: s, curEnd: e, priorStart: ps, priorEnd: pe };
  }

  const { curStart, curEnd, priorStart, priorEnd } = getRevenueDateBounds(revenueFilter);

  const periodEarnings = allPayments
    .filter((p) => { const d = new Date(p.paid_at); return d >= curStart && d <= curEnd; })
    .reduce((s, p) => s + p.amount, 0);

  const priorEarnings = allPayments
    .filter((p) => { const d = new Date(p.paid_at); return d >= priorStart && d <= priorEnd; })
    .reduce((s, p) => s + p.amount, 0);

  const periodJobCount = jobs.filter(
    (j) => j.status === "completed" && j.completed_at &&
      new Date(j.completed_at) >= curStart && new Date(j.completed_at) <= curEnd
  ).length;

  const growthPct = priorEarnings > 0
    ? ((periodEarnings - priorEarnings) / priorEarnings) * 100
    : null;

  // Crew filter
  const crewFiltered = selectedCrewMember === null
    ? jobs
    : jobs.filter((j) => j.job_crew.some((c) => c.team_member_id === selectedCrewMember));

  // Price filter
  const priceCeiling = jobs.length > 0
    ? Math.max(Math.ceil(Math.max(...jobs.map((j) => j.total)) / 100) * 100, 100)
    : 1000;
  const sliderStep = priceCeiling <= 1000 ? 10 : priceCeiling <= 5000 ? 50 : 100;
  const isPriceFiltered = priceMin > 0 || priceMax !== null;
  const baseFiltered = isPriceFiltered
    ? crewFiltered.filter((j) => j.total >= priceMin && (priceMax === null || j.total <= priceMax))
    : crewFiltered;

  // Status splits
  const inProgressJobs = baseFiltered
    .filter((j) => j.status === "in_progress")
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

  const scheduledJobs = baseFiltered.filter((j) => j.status === "scheduled");

  const completedJobsList = baseFiltered
    .filter((j) => j.status === "completed")
    .sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at));

  // Date bucket boundaries (local time)
  const todayStr = toLocalDateStr(new Date());
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toLocalDateStr(tomorrowDate);
  const dayAfterDate = new Date(); dayAfterDate.setDate(dayAfterDate.getDate() + 2);
  const dayAfterStr = toLocalDateStr(dayAfterDate);
  const daysUntilSunday = (7 - new Date().getDay()) % 7 || 7;
  const endOfWeekDate = new Date(); endOfWeekDate.setDate(endOfWeekDate.getDate() + daysUntilSunday);
  const endOfWeekStr = toLocalDateStr(endOfWeekDate);

  function bucketJobs(src: Job[], from: string, to: string) {
    return src
      .filter((j) => {
        if (!j.scheduled_at) return false;
        const ds = toLocalDateStr(new Date(j.scheduled_at));
        return ds >= from && ds <= to;
      })
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  }

  const todayBucket = bucketJobs(scheduledJobs, todayStr, todayStr);
  const scheduledTomorrow = bucketJobs(scheduledJobs, tomorrowStr, tomorrowStr);
  const thisWeekBucket = bucketJobs(scheduledJobs, dayAfterStr, endOfWeekStr);
  const upcomingBucket = scheduledJobs
    .filter((j) => !j.scheduled_at || toLocalDateStr(new Date(j.scheduled_at)) > endOfWeekStr)
    .sort((a, b) => (a.scheduled_at ?? "zzz").localeCompare(b.scheduled_at ?? "zzz"));

  // Next week boundaries
  const nextWeekStartDate = new Date(); nextWeekStartDate.setDate(nextWeekStartDate.getDate() + daysUntilSunday + 1);
  const nextWeekEndDate = new Date(nextWeekStartDate); nextWeekEndDate.setDate(nextWeekStartDate.getDate() + 6);
  const nextWeekStartStr = toLocalDateStr(nextWeekStartDate);
  const nextWeekEndStr = toLocalDateStr(nextWeekEndDate);

  // Next month boundaries
  const now2 = new Date();
  const nextMonthStartDate = new Date(now2.getFullYear(), now2.getMonth() + 1, 1);
  const nextMonthEndDate = new Date(now2.getFullYear(), now2.getMonth() + 2, 0);
  const nextMonthStartStr = toLocalDateStr(nextMonthStartDate);
  const nextMonthEndStr = toLocalDateStr(nextMonthEndDate);

  // Custom date range
  const customBucket = (customDateFrom && customDateTo)
    ? bucketJobs(scheduledJobs, customDateFrom, customDateTo)
    : [];

  // Which scheduled jobs to show based on time filter
  const filteredScheduledJobs: Job[] | null = (() => {
    switch (timeFilter) {
      case "today": return todayBucket;
      case "tomorrow": return scheduledTomorrow;
      case "this_week": return bucketJobs(scheduledJobs, todayStr, endOfWeekStr);
      case "next_week": return bucketJobs(scheduledJobs, nextWeekStartStr, nextWeekEndStr);
      case "next_month": return bucketJobs(scheduledJobs, nextMonthStartStr, nextMonthEndStr);
      case "custom": return customBucket;
      default: return null; // "all" uses multi-bucket rendering
    }
  })();

  const hasAnyJobs = inProgressJobs.length + scheduledJobs.length + completedJobsList.length > 0;


  return (
    <div className="flex flex-col gap-3 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-4 lg:pb-8">
      {/* Greeting + compact stats */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{getTodayLabel()}</p>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>

        {/* Revenue card */}
        <div className="rounded-xl bg-card border border-border/60 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                trending_up
              </span>
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Revenue</span>
            </div>
            <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
              {(["today", "week", "month", "year"] as const).map((p) => {
                const label = p === "today" ? "Today" : p === "week" ? "Week" : p === "month" ? "Month" : "Year";
                return (
                  <button
                    key={p}
                    onClick={() => setRevenueFilter(p)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                      revenueFilter === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <span className="text-2xl font-extrabold text-foreground leading-none">
            {statsLoaded ? formatCurrencyRounded(periodEarnings, currency) : "—"}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {periodJobCount} job{periodJobCount !== 1 ? "s" : ""}
            </span>
            {growthPct !== null && (
              <span className={`text-[10px] font-semibold ${growthPct >= 0 ? "text-green-500" : "text-red-400"}`}>
                {growthPct >= 0 ? "+" : ""}{growthPct.toFixed(0)}% vs prior {revenueFilter}
              </span>
            )}
          </div>
        </div>

        {/* Outstanding + New Quote row */}
        <div className="flex items-center gap-2">
          <div
            onClick={() => outstandingCount > 0 && router.push("/payments")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/60 shadow-sm min-w-0 shrink ${
              outstandingCount > 0
                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 cursor-pointer"
                : "bg-card"
            }`}
          >
            <span
              className="material-symbols-outlined text-[13px]"
              style={{
                fontVariationSettings: "'FILL' 1",
                color: outstandingCount > 0 ? "#f59e0b" : "var(--color-primary)",
              }}
            >
              {outstandingCount > 0 ? "pending_actions" : "check_circle"}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide leading-none truncate">Outstanding</span>
              <span className={`text-xs font-extrabold leading-tight truncate ${outstandingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {!statsLoaded ? "—" : outstandingCount > 0 ? formatCurrencyRounded(outstandingAmount, currency) : "✓ Clear"}
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/quotes/new")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary text-white shadow-sm active:scale-95 transition-transform shrink-0 ml-auto"
            style={{ boxShadow: "0 2px 8px oklch(0.511 0.230 277 / 0.30)" }}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span className="text-xs font-bold">New Quote</span>
          </button>
        </div>
      </div>

      {/* Tomorrow's jobs reminder banner */}
      {smsReminders && tomorrowJobs.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
            <p className="text-sm font-bold text-foreground">
              {tomorrowJobs.length} job{tomorrowJobs.length !== 1 ? "s" : ""} tomorrow — send reminders?
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {tomorrowJobs.map((j) => {
              const time = new Date(j.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              const phone = j.clients?.phone;
              const clientName = j.clients?.name ?? "Client";
              return (
                <div key={j.id} className="flex items-center justify-between gap-2 bg-background rounded-xl px-3 py-2 border border-border/50">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">{clientName}</span>
                    <span className="text-xs text-muted-foreground">{time}</span>
                  </div>
                  {phone ? (
                    <a
                      href={`sms:${phone}?body=${encodeURIComponent(buildReminderSms(clientName, firstName, businessName, j.scheduled_at, j.service_type, reminderTemplates))}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shrink-0 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">sms</span>
                      Send Reminder
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0 italic">No phone</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time filter chips + filter icon button */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* Scrollable time chips — flex-1 so the filter icon stays pinned right */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0 -ml-4 pl-4 lg:ml-0 lg:pl-0">
            {(["all", "today", "tomorrow", "this_week", "next_week", "next_month", "custom"] as const).map((f) => {
              const labels: Record<typeof f, string> = { all: "All", today: "Today", tomorrow: "Tomorrow", this_week: "This Week", next_week: "Next Week", next_month: "Next Month", custom: "Custom" };
              return (
                <button key={f} onClick={() => setTimeFilter(f)} className="shrink-0">
                  <Badge
                    className={`px-3 py-1 text-xs rounded-full cursor-pointer transition-colors whitespace-nowrap ${timeFilter === f ? "bg-primary text-white hover:bg-primary/90" : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"}`}
                    variant={timeFilter === f ? "default" : "outline"}
                  >
                    {labels[f]}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Filter icon button — pinned right, outside the scroll container so dropdown isn't clipped */}
          {teamMembers.length > 0 && (
            <div className="relative shrink-0" ref={crewDropdownRef}>
              <button
                onClick={() => setShowCrewPanel((v) => !v)}
                className={`flex items-center justify-center size-8 rounded-full border transition-colors ${
                  selectedCrewMember !== null || isPriceFiltered
                    ? "bg-primary text-white border-primary"
                    : showCrewPanel
                    ? "bg-muted text-foreground border-border"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
              </button>

              {/* Floating dropdown */}
              {showCrewPanel && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl bg-card border border-border shadow-xl overflow-hidden">

                  {/* Member section */}
                  {teamMembers.length > 0 && (
                    <>
                      <div className="p-2 border-b border-border/60">
                        <input
                          type="text"
                          placeholder="Search member…"
                          value={crewSearch}
                          onChange={(e) => setCrewSearch(e.target.value)}
                          autoFocus
                          className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                        />
                      </div>
                      <div className="flex flex-col p-1.5 gap-0.5 max-h-36 overflow-y-auto border-b border-border/60">
                        <button
                          onClick={() => { setSelectedCrewMember(null); setCrewSearch(""); }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors ${selectedCrewMember === null ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}
                        >
                          <span className="material-symbols-outlined text-[16px]">group</span>
                          All Members
                        </button>
                        {teamMembers
                          .filter((m) => m.name.toLowerCase().includes(crewSearch.toLowerCase()))
                          .map((m) => (
                            <button
                              key={m.id}
                              onClick={() => { setSelectedCrewMember(m.id); setCrewSearch(""); }}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors ${selectedCrewMember === m.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}
                            >
                              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-extrabold text-primary">
                                {getInitials(m.name)}
                              </span>
                              {m.name}
                            </button>
                          ))}
                        {teamMembers.filter((m) => m.name.toLowerCase().includes(crewSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">No members found.</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Price section */}
                  <div className="p-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price Range</p>
                      {isPriceFiltered && (
                        <button
                          onClick={() => { setPriceMin(0); setPriceMax(null); }}
                          className="text-[10px] text-primary font-semibold hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Min slider */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium">Min</span>
                        <span className="text-[11px] font-bold text-foreground">${priceMin.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={priceMax ?? priceCeiling}
                        step={sliderStep}
                        value={priceMin}
                        onChange={(e) => setPriceMin(Number(e.target.value))}
                        className="w-full cursor-pointer appearance-none rounded-full h-1 bg-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                      />
                    </div>

                    {/* Max slider */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium">Max</span>
                        <span className="text-[11px] font-bold text-foreground">{priceMax === null ? "Any" : `$${priceMax.toLocaleString()}`}</span>
                      </div>
                      <input
                        type="range"
                        min={priceMin}
                        max={priceCeiling}
                        step={sliderStep}
                        value={priceMax ?? priceCeiling}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPriceMax(v >= priceCeiling ? null : v);
                        }}
                        className="w-full cursor-pointer appearance-none rounded-full h-1 bg-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                      />
                    </div>

                    {/* Min/Max number inputs */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">$</span>
                        <input
                          type="number"
                          min={0}
                          max={priceMax ?? priceCeiling}
                          step={sliderStep}
                          value={priceMin}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value));
                            setPriceMin(Math.min(v, priceMax ?? priceCeiling));
                          }}
                          className="w-full pl-5 pr-2 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                        />
                      </div>
                      <span className="text-muted-foreground text-sm shrink-0">–</span>
                      <div className="flex-1 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">$</span>
                        <input
                          type="number"
                          min={priceMin}
                          step={sliderStep}
                          value={priceMax ?? priceCeiling}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v >= priceMin) setPriceMax(v >= priceCeiling ? null : v);
                          }}
                          className="w-full pl-5 pr-2 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>

        {/* Inline custom date inputs */}
        {timeFilter === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            <span className="text-muted-foreground text-sm font-bold shrink-0">→</span>
            <input
              type="date"
              value={customDateTo}
              min={customDateFrom || undefined}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            {(customDateFrom || customDateTo) && (
              <button
                onClick={() => { setCustomDateFrom(""); setCustomDateTo(""); }}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

      {!loading && (
        <div className="flex flex-col gap-6">

          {/* In Progress */}
          {inProgressJobs.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader label="In Progress" count={inProgressJobs.length} color={STATUS_HEX.in_progress} />
              <JobGrid jobs={inProgressJobs} />
            </section>
          )}

          {/* Scheduled — multi-bucket when "All", flat list for specific time filters */}
          {(timeFilter === "all" ? scheduledJobs.length > 0 : true) && (
            <section className="flex flex-col gap-3">
              <SectionHeader label="Scheduled" color={STATUS_HEX.scheduled} />
              {timeFilter === "all" ? (
                <div className="flex flex-col gap-5">
                  {todayBucket.length > 0 && <BucketGroup label="Today" jobs={todayBucket} />}
                  {scheduledTomorrow.length > 0 && <BucketGroup label="Tomorrow" jobs={scheduledTomorrow} />}
                  {thisWeekBucket.length > 0 && <BucketGroup label="This Week" jobs={thisWeekBucket} />}
                  {upcomingBucket.length > 0 && <BucketGroup label="Upcoming" jobs={upcomingBucket} />}
                  {scheduledJobs.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No scheduled jobs.</p>
                  )}
                </div>
              ) : timeFilter === "custom" && !customDateFrom && !customDateTo ? (
                <p className="text-sm text-muted-foreground py-2">Pick a date range above to search.</p>
              ) : (filteredScheduledJobs?.length ?? 0) > 0 ? (
                <JobGrid jobs={filteredScheduledJobs!} />
              ) : (
                <p className="text-sm text-muted-foreground py-2">No jobs for this period.</p>
              )}
            </section>
          )}

          {/* Completed — collapsed by default */}
          {completedJobsList.length > 0 && (
            <section className="flex flex-col gap-3">
              <button onClick={() => setCompletedExpanded((e) => !e)} className="w-full text-left">
                <SectionHeader label="Completed" count={completedJobsList.length} color={STATUS_HEX.completed} collapsible expanded={completedExpanded} />
              </button>
              {completedExpanded && <JobGrid jobs={completedJobsList} />}
            </section>
          )}

          {/* Empty state */}
          {!hasAnyJobs && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">work_off</span>
              <p className="text-sm font-medium text-muted-foreground">No jobs here yet</p>
              <p className="text-xs text-muted-foreground/60">Mark a quote as won to create a job</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function SectionHeader({ label, count, color, collapsible, expanded }: {
    label: string; count?: number; color: string; collapsible?: boolean; expanded?: boolean;
  }) {
    return (
      <div className="flex items-center gap-2">
        <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex-1">{label}</span>
        {count !== undefined && (
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count}</span>
        )}
        {collapsible && (
          <span className={`material-symbols-outlined text-[16px] text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}>
            expand_more
          </span>
        )}
      </div>
    );
  }

  function BucketGroup({ label, jobs }: { label: string; jobs: Job[] }) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{label}</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>
        <JobGrid jobs={jobs} />
      </div>
    );
  }

  function JobGrid({ jobs }: { jobs: Job[] }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {jobs.map((job) => <JobCard key={job.id} job={job} />)}
      </div>
    );
  }

  function JobCard({ job }: { job: Job }) {
    const color = STATUS_HEX[job.status];
    const title = job.job_line_items[0]?.description ?? "Job";
    const extraItems = job.job_line_items.length - 1;
    return (
      <Card
        onClick={() => router.push(`/jobs/${job.id}`)}
        className="overflow-hidden rounded-2xl cursor-pointer flex flex-col press"
      >
        <div className="h-1 w-full" style={{ backgroundColor: color }} />
        <div className="p-3 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: color }}>
                <span className="material-symbols-outlined text-[17px]">home_repair_service</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-foreground leading-tight">
                  {title}{extraItems > 0 ? ` +${extraItems} more` : ""}
                </h3>
                <span className="text-sm font-medium text-muted-foreground">{job.clients?.name ?? "Unknown client"}</span>
              </div>
            </div>
            <span className="font-extrabold text-foreground">{formatCurrency(job.total, currency)}</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl p-2 border border-border/50">
            <span className="material-symbols-outlined text-[14px] text-muted-foreground">calendar_clock</span>
            <span className="text-xs text-foreground font-medium">{formatScheduled(job.scheduled_at)}</span>
            {job.clients?.address && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground truncate">{job.clients.address}</span>
              </>
            )}
          </div>
          {(job.status === "completed" || job.status === "cancelled") && (
            <div className="flex items-center justify-end">
              {job.status === "completed" && <Badge variant="secondary" className={`${STATUS_CLASS.completed} border-0`}>Completed ✓</Badge>}
              {job.status === "cancelled" && <Badge variant="secondary" className={`${STATUS_CLASS.cancelled} border-0`}>Cancelled</Badge>}
            </div>
          )}
        </div>
      </Card>
    );
  }
}
