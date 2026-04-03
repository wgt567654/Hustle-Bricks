"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduled_at: string | null;
  total: number;
  notes: string | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
};

type TimeEntry = {
  id: string;
  job_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
};

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function EmployeeHomePage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  const todayLabel = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id, name, business_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!tm) return;
      setEmployeeId(tm.id);
      setBusinessId(tm.business_id);

      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const [{ data: todayJobs }, { data: openEntry }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, scheduled_at, total, notes, clients(name, address), job_line_items(description)")
          .eq("assigned_member_id", tm.id)
          .in("status", ["scheduled", "in_progress"])
          .gte("scheduled_at", startOfToday.toISOString())
          .lte("scheduled_at", endOfToday.toISOString())
          .order("scheduled_at"),
        supabase
          .from("time_entries")
          .select("id, job_id, clocked_in_at, clocked_out_at")
          .eq("employee_id", tm.id)
          .is("clocked_out_at", null)
          .order("clocked_in_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setJobs((todayJobs as unknown as Job[]) ?? []);
      setActiveEntry(openEntry as TimeEntry | null);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function clockIn(jobId: string) {
    if (!employeeId || !businessId) return;
    setClockingIn(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("time_entries")
      .insert({ employee_id: employeeId, job_id: jobId, business_id: businessId })
      .select("id, job_id, clocked_in_at, clocked_out_at")
      .single();
    if (data) setActiveEntry(data as TimeEntry);
    setClockingIn(false);
  }

  async function clockOut() {
    if (!activeEntry) return;
    setClockingOut(true);
    const supabase = createClient();
    await supabase
      .from("time_entries")
      .update({ clocked_out_at: new Date().toISOString() })
      .eq("id", activeEntry.id);
    setActiveEntry(null);
    setClockingOut(false);
  }

  const activeJob = activeEntry ? jobs.find((j) => j.id === activeEntry.job_id) : null;

  return (
    <div className="flex flex-col gap-5 px-4 py-5 max-w-xl mx-auto">

      {/* Greeting */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      {/* Clock in/out card */}
      {!loading && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-4 border ${
            activeEntry
              ? "bg-[#16a34a]/8 border-[#16a34a]/25"
              : "bg-muted/40 border-border"
          }`}
        >
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
              activeEntry ? "bg-[#16a34a]/15 text-[#16a34a]" : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: activeEntry ? "'FILL' 1" : "'FILL' 0" }}
            >
              schedule
            </span>
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            {activeEntry ? (
              <>
                <span className="font-bold text-[#16a34a] text-sm">Clocked in</span>
                <span className="text-xs text-muted-foreground truncate">
                  {activeJob
                    ? (activeJob.job_line_items[0]?.description ?? "Job") + " · " + (activeJob.clients?.name ?? "")
                    : "Since " + formatTime(activeEntry.clocked_in_at)}
                </span>
              </>
            ) : (
              <>
                <span className="font-bold text-foreground text-sm">Not clocked in</span>
                <span className="text-xs text-muted-foreground">Tap a job below to clock in</span>
              </>
            )}
          </div>

          {activeEntry && (
            <button
              onClick={clockOut}
              disabled={clockingOut}
              className="shrink-0 px-3.5 py-2 rounded-xl bg-[#16a34a] text-white font-bold text-xs hover:bg-[#16a34a]/90 active:scale-95 transition-all disabled:opacity-50"
            >
              {clockingOut ? "…" : "Clock Out"}
            </button>
          )}
        </div>
      )}

      {/* Today's jobs */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today&apos;s Jobs</h2>

        {loading && (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        )}

        {!loading && jobs.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center rounded-2xl border border-dashed border-border">
            <span className="material-symbols-outlined text-[40px] text-muted-foreground/30">event_available</span>
            <p className="text-sm font-semibold text-muted-foreground">No jobs today</p>
            <p className="text-xs text-muted-foreground/60">Check your schedule for upcoming work</p>
          </div>
        )}

        {jobs.map((job) => {
          const isClockedIntoThis = activeEntry?.job_id === job.id;
          return (
            <div
              key={job.id}
              className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
            >
              <button
                onClick={() => router.push(`/employee/jobs/${job.id}`)}
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/20 active:bg-muted/40 transition-colors"
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl mt-0.5 ${
                    job.status === "in_progress"
                      ? "bg-[#ea580c]/10 text-[#ea580c]"
                      : "bg-[#007AFF]/10 text-[#007AFF]"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {job.status === "in_progress" ? "play_circle" : "work"}
                  </span>
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-bold text-foreground text-sm leading-snug truncate">
                    {job.job_line_items[0]?.description ?? "Job"}
                  </span>
                  <span className="text-xs text-muted-foreground">{job.clients?.name ?? ""}</span>
                  {job.clients?.address && (
                    <span className="text-xs text-muted-foreground truncate mt-0.5">{job.clients.address}</span>
                  )}
                  {job.scheduled_at && (
                    <span className="text-xs font-medium text-[#007AFF] mt-1">{formatTime(job.scheduled_at)}</span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      job.status === "in_progress"
                        ? "bg-[#ea580c]/10 text-[#ea580c]"
                        : "bg-[#007AFF]/10 text-[#007AFF]"
                    }`}
                  >
                    {job.status === "in_progress" ? "In Progress" : "Scheduled"}
                  </span>
                  <span className="material-symbols-outlined text-muted-foreground/40 text-[15px]">chevron_right</span>
                </div>
              </button>

              {/* Clock in strip — only when not already clocked into anything */}
              {!activeEntry && (
                <div className="border-t border-border/40 bg-muted/20">
                  <button
                    onClick={() => clockIn(job.id)}
                    disabled={clockingIn}
                    className="w-full py-2.5 text-sm font-semibold text-[#16a34a] flex items-center justify-center gap-1.5 hover:bg-muted/40 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      login
                    </span>
                    {clockingIn ? "Clocking in…" : "Clock In"}
                  </button>
                </div>
              )}

              {/* Clocked into this job indicator */}
              {isClockedIntoThis && (
                <div className="border-t border-[#16a34a]/20 bg-[#16a34a]/5 px-4 py-2 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#16a34a] animate-pulse" />
                  <span className="text-xs font-bold text-[#16a34a]">Clocked in since {formatTime(activeEntry.clocked_in_at)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
