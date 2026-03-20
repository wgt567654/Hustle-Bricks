"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";

type JobStatus = "scheduled" | "in_progress" | "completed";

type TodayJob = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
};

const STATUS_COLOR: Record<string, string> = {
  scheduled: "#007AFF",
  in_progress: "#ea580c",
  completed: "#16a34a",
};

function formatTime(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

const QUICK_ACTIONS = [
  { label: "New Quote", icon: "request_quote", href: "/quotes/new", color: "#007AFF", bg: "bg-[#007AFF]/10" },
  { label: "Jobs", icon: "home_repair_service", href: "/jobs", color: "#ea580c", bg: "bg-[#ea580c]/10" },
  { label: "Clients", icon: "groups", href: "/clients", color: "#16a34a", bg: "bg-[#16a34a]/10" },
  { label: "Pipeline", icon: "trending_up", href: "/sales", color: "#8b5cf6", bg: "bg-[#8b5cf6]/10" },
];

export default function Home() {
  const router = useRouter();
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [outstandingCount, setOutstandingCount] = useState(0);
  const [weekJobsDone, setWeekJobsDone] = useState(0);
  const [todayJobs, setTodayJobs] = useState<TodayJob[]>([]);
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);
  const [clientCount, setClientCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [quoteCount, setQuoteCount] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fullName: string = user.user_metadata?.full_name ?? user.email ?? "";
      setFirstName(fullName.split(" ")[0] || "there");

      const businessId = await getBusinessId(supabase);
      if (!businessId) return;

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

      const [
        { data: weekPayments },
        { data: monthPayments },
        { data: todayJobsData },
        { data: completedJobs },
        { data: weekCompleted },
        { count: clientsCount },
        { count: servicesCount },
        { count: quotesCount },
      ] = await Promise.all([
        supabase.from("payments").select("amount").eq("business_id", businessId)
          .eq("status", "paid").gte("paid_at", startOfWeek.toISOString()),
        supabase.from("payments").select("amount").eq("business_id", businessId)
          .eq("status", "paid").gte("paid_at", startOfMonth.toISOString()),
        supabase.from("jobs")
          .select("id, status, total, scheduled_at, clients(name, address), job_line_items(description)")
          .eq("business_id", businessId)
          .or(`scheduled_at.gte.${startOfToday.toISOString()},status.eq.in_progress`)
          .lte("scheduled_at", endOfToday.toISOString())
          .in("status", ["scheduled", "in_progress"])
          .order("scheduled_at"),
        supabase.from("jobs").select("id, total, payments(id)")
          .eq("business_id", businessId).eq("status", "completed"),
        supabase.from("jobs").select("id")
          .eq("business_id", businessId).eq("status", "completed")
          .gte("created_at", startOfWeek.toISOString()),
        supabase.from("clients").select("id", { count: "exact", head: true })
          .eq("business_id", businessId),
        supabase.from("services").select("id", { count: "exact", head: true })
          .eq("business_id", businessId),
        supabase.from("quotes").select("id", { count: "exact", head: true })
          .eq("business_id", businessId),
      ]);

      setWeekEarnings((weekPayments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0));
      setMonthEarnings((monthPayments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0));
      setTodayJobs((todayJobsData as unknown as TodayJob[]) ?? []);
      setWeekJobsDone(weekCompleted?.length ?? 0);

      const unpaid = (completedJobs ?? []).filter(
        (j: { payments: { id: string }[] }) => !j.payments || j.payments.length === 0
      );
      setOutstandingCount(unpaid.length);
      setOutstandingAmount((unpaid as { total: number }[]).reduce((s, j) => s + j.total, 0));

      setClientCount(clientsCount ?? 0);
      setServiceCount(servicesCount ?? 0);
      setQuoteCount(quotesCount ?? 0);

      setLoading(false);
    }
    load();
  }, []);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-28">

      {/* Greeting header */}
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{getTodayLabel()}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          {getGreeting()}{firstName ? `, ${firstName}` : ""}
        </h1>
      </div>

      {/* Hero earnings card */}
      <div className="relative overflow-hidden rounded-3xl bg-[#007AFF] p-6 text-white" style={{ boxShadow: "0 8px 32px rgba(0,122,255,0.35), 0 2px 8px rgba(0,122,255,0.2)" }}>
        {/* Background orbs */}
        <div className="absolute -right-12 -top-12 size-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 size-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute right-1/3 top-1/2 size-24 rounded-full bg-white/5 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          {/* Label row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  attach_money
                </span>
              </div>
              <span className="text-sm font-bold text-white/80 uppercase tracking-wider">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-white/70 bg-white/15 px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
              This Week
            </div>
          </div>

          {/* Main number */}
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white/70">$</span>
            <span className="text-5xl font-extrabold tracking-tighter text-white leading-none">
              {loading ? "—" : fmt(weekEarnings)}
            </span>
          </div>

          {/* Sub-metrics row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Jobs Done</span>
              <span className="text-xl font-extrabold text-white leading-none">{loading ? "—" : weekJobsDone}</span>
            </div>
            <div
              onClick={() => outstandingCount > 0 && router.push("/payments")}
              className={`bg-white/15 rounded-2xl px-3 py-2.5 flex flex-col gap-0.5 ${outstandingCount > 0 ? "cursor-pointer hover:bg-white/25 transition-colors" : ""}`}
            >
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Outstanding</span>
              <span className={`text-xl font-extrabold leading-none ${outstandingCount > 0 ? "text-[#fbbf24]" : "text-white"}`}>
                {loading ? "—" : outstandingCount > 0 ? `$${fmt(outstandingAmount)}` : "✓ Clear"}
              </span>
            </div>
            <div className="bg-white/15 rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">This Month</span>
              <span className="text-xl font-extrabold text-white leading-none">{loading ? "—" : `$${fmt(monthEarnings)}`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.href}
            onClick={() => router.push(a.href)}
            className="flex flex-col items-center gap-2 press"
          >
            <div className={`flex size-14 items-center justify-center rounded-2xl ${a.bg} shadow-card`} style={{ borderColor: `${a.color}20` }}>
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ color: a.color, fontVariationSettings: "'FILL' 1" }}
              >
                {a.icon}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground leading-tight text-center">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Onboarding checklist — hidden once all steps complete */}
      {!loading && !(clientCount > 0 && serviceCount > 0 && quoteCount > 0) && (
        <Card className="rounded-2xl overflow-hidden">
          <div className="p-4 flex flex-col gap-1 border-b border-border/50">
            <h3 className="text-sm font-extrabold text-foreground">Get started</h3>
            <p className="text-xs text-muted-foreground">Complete these steps to set up your business</p>
          </div>
          <div className="flex flex-col divide-y divide-border/50">
            {/* Step 1: Add first client */}
            <button
              onClick={() => router.push("/clients")}
              className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors active:bg-muted/50"
            >
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${clientCount > 0 ? "bg-[#16a34a]/10" : "bg-[#007AFF]/10"}`}>
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    color: clientCount > 0 ? "#16a34a" : "#007AFF",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  person_add
                </span>
              </div>
              <span className={`flex-1 text-sm ${clientCount > 0 ? "text-muted-foreground line-through" : "font-bold text-foreground"}`}>
                Add your first client
              </span>
              {clientCount > 0 ? (
                <span className="material-symbols-outlined text-[20px] text-[#16a34a]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              ) : (
                <span className="material-symbols-outlined text-[20px] text-[#007AFF]">chevron_right</span>
              )}
            </button>

            {/* Step 2: Add a service */}
            <button
              onClick={() => router.push("/services")}
              className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors active:bg-muted/50"
            >
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${serviceCount > 0 ? "bg-[#16a34a]/10" : "bg-[#007AFF]/10"}`}>
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    color: serviceCount > 0 ? "#16a34a" : "#007AFF",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  home_repair_service
                </span>
              </div>
              <span className={`flex-1 text-sm ${serviceCount > 0 ? "text-muted-foreground line-through" : "font-bold text-foreground"}`}>
                Add a service to your catalog
              </span>
              {serviceCount > 0 ? (
                <span className="material-symbols-outlined text-[20px] text-[#16a34a]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              ) : (
                <span className="material-symbols-outlined text-[20px] text-[#007AFF]">chevron_right</span>
              )}
            </button>

            {/* Step 3: Create first quote */}
            <button
              onClick={() => router.push("/quotes/new")}
              className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors active:bg-muted/50"
            >
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${quoteCount > 0 ? "bg-[#16a34a]/10" : "bg-[#007AFF]/10"}`}>
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    color: quoteCount > 0 ? "#16a34a" : "#007AFF",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  request_quote
                </span>
              </div>
              <span className={`flex-1 text-sm ${quoteCount > 0 ? "text-muted-foreground line-through" : "font-bold text-foreground"}`}>
                Create your first quote
              </span>
              {quoteCount > 0 ? (
                <span className="material-symbols-outlined text-[20px] text-[#16a34a]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              ) : (
                <span className="material-symbols-outlined text-[20px] text-[#007AFF]">chevron_right</span>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* Today's schedule */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Today's Schedule</h3>
            {todayJobs.length > 0 && (
              <Badge variant="secondary" className="bg-[#007AFF]/10 text-[#007AFF] border-0 text-[10px] font-bold">
                {todayJobs.length}
              </Badge>
            )}
          </div>
          <button
            onClick={() => router.push("/jobs")}
            className="flex items-center gap-1 text-xs font-bold text-[#007AFF] uppercase tracking-wide hover:underline"
          >
            All Jobs
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </button>
        </div>

        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && todayJobs.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center bg-card rounded-2xl border border-border/50">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50">
              <span className="material-symbols-outlined text-[28px] text-muted-foreground/40" style={{ fontVariationSettings: "'FILL' 1" }}>
                wb_sunny
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Nothing on the books today</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ready to hustle? Create your next quote.</p>
            </div>
            <button
              onClick={() => router.push("/quotes/new")}
              className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#007AFF] text-white text-sm font-bold hover:bg-[#007AFF]/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              New Quote
            </button>
          </div>
        )}

        {todayJobs.length > 0 && (
          <div className="flex flex-col gap-3">
            {todayJobs.map((job) => {
              const color = STATUS_COLOR[job.status] ?? "#007AFF";
              const time = formatTime(job.scheduled_at);
              const title = job.job_line_items[0]?.description ?? "Job";

              return (
                <Card
                  key={job.id}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="overflow-hidden rounded-2xl cursor-pointer transition-all press"
                >
                  <div className="h-1 w-full" style={{ backgroundColor: color }} />
                  <div className="p-4 flex items-center gap-4">
                    {/* Time */}
                    <div className="flex flex-col items-center shrink-0 w-10">
                      <span className="text-xs font-extrabold text-foreground leading-tight">
                        {time ? time.split(" ")[0] : "—"}
                      </span>
                      {time && (
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">
                          {time.split(" ")[1]}
                        </span>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="w-px h-10 rounded-full" style={{ backgroundColor: `${color}40` }} />

                    {/* Icon */}
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        home_repair_service
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-bold text-foreground text-sm leading-tight truncate">{title}</span>
                      <span className="text-xs text-muted-foreground mt-0.5 truncate">
                        {job.clients?.address ?? job.clients?.name ?? "No address"}
                      </span>
                    </div>

                    {/* Right: price + badge */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-extrabold text-sm text-foreground">${job.total.toFixed(2)}</span>
                      {job.status === "in_progress" && (
                        <Badge variant="secondary" className="bg-[#ea580c]/10 text-[#ea580c] border-0 text-[9px] font-bold uppercase tracking-wide">
                          Live
                        </Badge>
                      )}
                      {job.status === "scheduled" && (
                        <Badge variant="secondary" className="bg-[#007AFF]/10 text-[#007AFF] border-0 text-[9px] font-bold uppercase tracking-wide">
                          Up Next
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* FAB */}
      <button
        onClick={() => router.push("/quotes/new")}
        className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-[#007AFF] text-white press"
        style={{ boxShadow: "0 4px 20px rgba(0,122,255,0.4), 0 1px 4px rgba(0,122,255,0.3)" }}
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
