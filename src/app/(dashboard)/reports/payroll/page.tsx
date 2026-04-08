"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type TimeEntry = {
  id: string;
  employee_id: string;
  job_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  team_members: { name: string } | null;
};

type AssignedJob = {
  id: string;
  assigned_member_id: string;
  status: string;
  completed_at: string | null;
};

type EmployeeSummary = {
  id: string;
  name: string;
  hours: number;
  miles: number;
  jobs: number;
};

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function PayrollPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<AssignedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"week" | "month" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const now = new Date();

  const { startDate, endDate } = useMemo(() => {
    if (range === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Sunday
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    if (range === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    // custom
    const start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = customEnd ? new Date(customEnd + "T23:59:59") : new Date();
    return { startDate: start, endDate: end };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (!business) return;

      const [{ data: entryData }, { data: jobData }] = await Promise.all([
        supabase
          .from("time_entries")
          .select("id, employee_id, job_id, clocked_in_at, clocked_out_at, odometer_start, odometer_end, team_members(name)")
          .eq("business_id", business.id)
          .gte("clocked_in_at", startDate.toISOString())
          .lte("clocked_in_at", endDate.toISOString())
          .not("clocked_out_at", "is", null),
        supabase
          .from("jobs")
          .select("id, assigned_member_id, status, completed_at")
          .eq("business_id", business.id)
          .eq("status", "completed")
          .not("assigned_member_id", "is", null)
          .gte("completed_at", startDate.toISOString())
          .lte("completed_at", endDate.toISOString()),
      ]);

      setEntries((entryData as unknown as TimeEntry[]) ?? []);
      setAssignedJobs((jobData as unknown as AssignedJob[]) ?? []);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  const summaries = useMemo((): EmployeeSummary[] => {
    const map: Record<string, EmployeeSummary> = {};

    for (const entry of entries) {
      const empId = entry.employee_id;
      const name = (entry.team_members as { name: string } | null)?.name ?? "Unknown";
      if (!map[empId]) map[empId] = { id: empId, name, hours: 0, miles: 0, jobs: 0 };

      // Hours
      if (entry.clocked_out_at) {
        const ms = new Date(entry.clocked_out_at).getTime() - new Date(entry.clocked_in_at).getTime();
        map[empId].hours += ms / 3_600_000;
      }

      // Miles
      if (entry.odometer_start != null && entry.odometer_end != null && entry.odometer_end > entry.odometer_start) {
        map[empId].miles += entry.odometer_end - entry.odometer_start;
      }
    }

    // Jobs completed
    for (const job of assignedJobs) {
      const empId = job.assigned_member_id;
      if (map[empId]) {
        map[empId].jobs += 1;
      } else {
        // Employee had completed jobs but no time entries in range — include them
        map[empId] = { id: empId, name: "Employee", hours: 0, miles: 0, jobs: 1 };
      }
    }

    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [entries, assignedJobs]);

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }, [startDate, endDate]);

  const totalHours = summaries.reduce((s, e) => s + e.hours, 0);
  const totalMiles = summaries.reduce((s, e) => s + e.miles, 0);
  const totalJobs = summaries.reduce((s, e) => s + e.jobs, 0);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-32 print:px-0 print:py-0 print:max-w-none">

      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <button
          onClick={() => router.push("/reports")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex flex-col flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Payroll Summary</h1>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80 transition-colors border border-border"
        >
          <span className="material-symbols-outlined text-[15px]">print</span>
          Print
        </button>
      </div>

      {/* Print-only title */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Payroll Summary — {rangeLabel}</h1>
      </div>

      {/* Range selector */}
      <div className="flex gap-2 print:hidden">
        {(["week", "month", "custom"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              range === r
                ? "bg-[#007AFF] text-white shadow-sm"
                : "bg-muted text-foreground border border-border hover:bg-muted/80"
            }`}
          >
            {r === "week" ? "This Week" : r === "month" ? "This Month" : "Custom"}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex gap-3 print:hidden">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Hours</span>
          <span className="text-xl font-extrabold text-foreground">{formatHours(totalHours)}</span>
        </Card>
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Miles</span>
          <span className="text-xl font-extrabold text-foreground">{totalMiles.toLocaleString()}</span>
        </Card>
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jobs Done</span>
          <span className="text-xl font-extrabold text-foreground">{totalJobs}</span>
        </Card>
      </div>

      {/* Employee table */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : summaries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center rounded-2xl border border-dashed border-border">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">badge</span>
          <p className="text-sm font-semibold text-muted-foreground">No data for this period</p>
          <p className="text-xs text-muted-foreground/60">Time entries will appear here once employees clock in</p>
        </div>
      ) : (
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Employee</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-14">Hours</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-14">Miles</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-12">Jobs</span>
          </div>
          {summaries.map((emp, i) => (
            <div
              key={emp.id}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3.5 items-center ${i < summaries.length - 1 ? "border-b border-border/40" : ""}`}
            >
              <span className="text-sm font-bold text-foreground truncate">{emp.name}</span>
              <span className="text-sm font-bold text-foreground text-right w-14">{formatHours(emp.hours)}</span>
              <span className="text-sm font-bold text-foreground text-right w-14">
                {emp.miles > 0 ? emp.miles.toLocaleString() : "—"}
              </span>
              <span className="text-sm font-bold text-foreground text-right w-12">{emp.jobs}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
