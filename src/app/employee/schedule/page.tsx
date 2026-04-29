"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduled_at: string | null;
  total: number;
  notes: string | null;
  route_order: number | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
};

type GroupedJobs = { label: string; jobs: Job[] }[];
type AvailDay = { from: string; until: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  const label = `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;
  return { value: `${String(h).padStart(2, "0")}:00`, label };
});

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  const days: Date[] = [];
  const current = new Date(startDate);
  while (current <= lastDay || days.length % 7 !== 0) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function groupJobs(jobs: Job[]): GroupedJobs {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const groups: Record<string, Job[]> = {};

  for (const job of jobs) {
    if (!job.scheduled_at) {
      const key = "Unscheduled";
      groups[key] = groups[key] ?? [];
      groups[key].push(job);
      continue;
    }

    const d = new Date(job.scheduled_at);
    d.setHours(0, 0, 0, 0);

    let label: string;
    if (d.getTime() === today.getTime()) {
      label = "Today";
    } else if (d.getTime() === tomorrow.getTime()) {
      label = "Tomorrow";
    } else {
      label = formatDate(job.scheduled_at);
    }

    groups[label] = groups[label] ?? [];
    groups[label].push(job);
  }

  const orderedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Today") return -1;
    if (b === "Today") return 1;
    if (a === "Tomorrow") return -1;
    if (b === "Tomorrow") return 1;
    if (a === "Unscheduled") return 1;
    if (b === "Unscheduled") return -1;
    return 0;
  });

  return orderedKeys.map((label) => ({
    label,
    jobs: [
      ...groups[label].filter((j) => j.route_order !== null).sort((a, b) => a.route_order! - b.route_order!),
      ...groups[label].filter((j) => j.route_order === null),
    ],
  }));
}

export default function EmployeeSchedulePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"jobs" | "hours">("jobs");

  // Jobs
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Identity
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Weekly availability
  const [availability, setAvailability] = useState<Record<number, AvailDay>>({});
  const [availLoading, setAvailLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Specific dates
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [unavailDateInput, setUnavailDateInput] = useState("");
  const [unavailMiniDate, setUnavailMiniDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [togglingDate, setTogglingDate] = useState(false);
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id, business_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!tm) return;
      setTeamMemberId(tm.id);
      setBusinessId(tm.business_id);

      const { data: jobData } = await supabase
        .from("jobs")
        .select("id, status, scheduled_at, total, notes, route_order, clients(name, address), job_line_items(description)")
        .eq("assigned_member_id", tm.id)
        .in("status", ["scheduled", "in_progress"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      setJobs((jobData as unknown as Job[]) ?? []);
      setLoading(false);

      const [{ data: availData }, { data: blockedData }] = await Promise.all([
        supabase.from("employee_availability").select("day_of_week, from_time, until_time").eq("team_member_id", tm.id),
        supabase.from("employee_blocked_dates").select("blocked_date").eq("team_member_id", tm.id),
      ]);

      const map: Record<number, AvailDay> = {};
      for (const row of availData ?? []) {
        map[row.day_of_week] = { from: row.from_time, until: row.until_time };
      }
      setAvailability(map);
      setBlockedDates(new Set((blockedData ?? []).map((r: { blocked_date: string }) => r.blocked_date)));
      setAvailLoading(false);
    }
    load();
  }, []);

  function toggleDay(day: number) {
    setAvailability((prev) => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      else next[day] = { from: "08:00", until: "17:00" };
      return next;
    });
  }

  function setHour(day: number, field: "from" | "until", value: string) {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...(prev[day] ?? { from: "08:00", until: "17:00" }), [field]: value },
    }));
  }

  function applyPreset(preset: "weekends-off" | "weekdays-off" | "all") {
    setAvailability((prev) => {
      if (preset === "weekends-off") {
        const next = { ...prev };
        delete next[0];
        delete next[6];
        return next;
      }
      if (preset === "weekdays-off") {
        const next = { ...prev };
        [1, 2, 3, 4, 5].forEach((d) => delete next[d]);
        return next;
      }
      return Object.fromEntries(
        [0, 1, 2, 3, 4, 5, 6].map((d) => [d, prev[d] ?? { from: "08:00", until: "17:00" }])
      );
    });
  }

  async function saveAvailability() {
    if (!teamMemberId || !businessId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("employee_availability").delete().eq("team_member_id", teamMemberId);
    const rows = Object.entries(availability).map(([day, hours]) => ({
      team_member_id: teamMemberId,
      business_id: businessId,
      day_of_week: parseInt(day),
      from_time: hours.from,
      until_time: hours.until,
    }));
    if (rows.length > 0) {
      await supabase.from("employee_availability").insert(rows);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function toggleBlockedDate(dateStr: string) {
    if (!teamMemberId || !businessId) return;
    setTogglingDate(true);
    const supabase = createClient();
    if (blockedDates.has(dateStr)) {
      await supabase.from("employee_blocked_dates")
        .delete()
        .eq("team_member_id", teamMemberId)
        .eq("blocked_date", dateStr);
      setBlockedDates((prev) => {
        const s = new Set(prev);
        s.delete(dateStr);
        return s;
      });
    } else {
      await supabase.from("employee_blocked_dates")
        .insert({ team_member_id: teamMemberId, business_id: businessId, blocked_date: dateStr });
      setBlockedDates((prev) => new Set([...prev, dateStr]));
    }
    setTogglingDate(false);
  }

  const grouped = groupJobs(jobs);
  const todayKey = dateKey(new Date());

  return (
    <div className="flex flex-col gap-5 px-4 py-5 max-w-xl mx-auto">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Schedule</h1>
        <p className="text-sm text-muted-foreground">Your upcoming jobs and available hours</p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-2xl bg-muted/60 p-1 gap-1">
        <button
          onClick={() => setTab("jobs")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
            tab === "jobs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Upcoming Jobs
        </button>
        <button
          onClick={() => setTab("hours")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
            tab === "hours" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          My Availability
        </button>
      </div>

      {/* ── Jobs tab ── */}
      {tab === "jobs" && (
        <>
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
          )}

          {!loading && jobs.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center rounded-2xl border border-dashed border-border">
              <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">
                event_available
              </span>
              <p className="text-sm font-semibold text-muted-foreground">No upcoming jobs</p>
              <p className="text-xs text-muted-foreground/60">Your manager will assign jobs here</p>
            </div>
          )}

          {grouped.map(({ label, jobs: groupJobs }) => (
            <div key={label} className="flex flex-col gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</h2>

              {groupJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => router.push(`/employee/jobs/${job.id}`)}
                  className="w-full rounded-2xl border border-border bg-card shadow-sm p-4 flex items-start gap-3 text-left hover:border-primary/30 active:scale-[0.99] transition-all"
                >
                  <div className="relative shrink-0 mt-0.5">
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${
                        job.status === "in_progress" ? "icon-orange" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {job.status === "in_progress" ? "play_circle" : "work"}
                      </span>
                    </div>
                    {job.route_order !== null && (
                      <div className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-primary border-2 border-background flex items-center justify-center text-[9px] font-extrabold text-white leading-none">
                        {job.route_order}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                    <span className="font-bold text-foreground text-sm leading-snug truncate">
                      {job.job_line_items[0]?.description ?? "Job"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{job.clients?.name ?? ""}</span>
                    {job.clients?.address && (
                      <span className="text-xs text-muted-foreground/70 truncate">{job.clients.address}</span>
                    )}
                    {job.scheduled_at && (
                      <span className="text-xs font-semibold text-primary mt-0.5">
                        {formatTime(job.scheduled_at)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        job.status === "in_progress" ? "icon-orange" : "bg-primary/10 text-primary"
                      }`}
                    >
                      {job.status === "in_progress" ? "In Progress" : "Scheduled"}
                    </span>
                    <span className="material-symbols-outlined text-muted-foreground/40 text-[15px]">chevron_right</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </>
      )}

      {/* ── Availability tab ── */}
      {tab === "hours" && (
        <div className="flex flex-col gap-5">

          {/* Specific Dates */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <p className="font-bold text-sm text-foreground">Specific Dates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Block holidays, vacations, or any one-off dates.</p>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Date picker row */}
              <div className="flex gap-2">
                <div
                  className="flex-1 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer select-none"
                  onClick={() => {
                    const el = datePickerRef.current;
                    if (!el) return;
                    if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
                      (el as HTMLInputElement & { showPicker: () => void }).showPicker();
                    } else {
                      el.focus();
                      el.click();
                    }
                  }}
                >
                  <span className={`text-sm font-medium ${unavailDateInput ? "text-foreground" : "text-muted-foreground"}`}>
                    {unavailDateInput
                      ? new Date(unavailDateInput + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })
                      : "Pick a date to block…"}
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground ml-2">expand_more</span>
                  <input
                    ref={datePickerRef}
                    type="date"
                    value={unavailDateInput}
                    className="sr-only"
                    onChange={(e) => {
                      setUnavailDateInput(e.target.value);
                      if (!e.target.value) return;
                      const d = new Date(e.target.value + "T12:00:00");
                      setUnavailMiniDate(new Date(d.getFullYear(), d.getMonth(), 1));
                    }}
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!unavailDateInput) return;
                    await toggleBlockedDate(unavailDateInput);
                    setUnavailDateInput("");
                  }}
                  disabled={!unavailDateInput || togglingDate}
                  className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-40 transition-colors shrink-0"
                >
                  Block
                </button>
              </div>

              {/* Month navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setUnavailMiniDate(new Date(unavailMiniDate.getFullYear(), unavailMiniDate.getMonth() - 1, 1))}
                  className="flex size-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <span className="text-sm font-extrabold text-foreground">
                  {MONTHS[unavailMiniDate.getMonth()]} {unavailMiniDate.getFullYear()}
                </span>
                <button
                  onClick={() => setUnavailMiniDate(new Date(unavailMiniDate.getFullYear(), unavailMiniDate.getMonth() + 1, 1))}
                  className="flex size-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold uppercase text-muted-foreground py-1">{d[0]}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays(unavailMiniDate.getFullYear(), unavailMiniDate.getMonth()).map((day) => {
                  const key = dateKey(day);
                  const isThisMonth = day.getMonth() === unavailMiniDate.getMonth();
                  const isBlocked = blockedDates.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => isThisMonth && toggleBlockedDate(key)}
                      disabled={!isThisMonth || togglingDate}
                      className={`flex items-center justify-center h-9 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        isBlocked
                          ? "bg-red-500 text-white shadow-sm"
                          : key === todayKey
                          ? "bg-primary/10 text-primary"
                          : !isThisMonth
                          ? "text-muted-foreground/30 cursor-default"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              {/* Blocked dates list */}
              {blockedDates.size > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Blocked Dates</p>
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {Array.from(blockedDates).sort().map((d) => (
                      <div key={d} className="flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
                        <span className="text-sm font-medium text-red-800 dark:text-red-300">
                          {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <button
                          onClick={() => toggleBlockedDate(d)}
                          className="flex size-6 items-center justify-center rounded-full text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {blockedDates.size === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Tap any date above to mark it unavailable.</p>
              )}
            </div>
          </div>

          {/* Weekly Schedule */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <p className="font-bold text-sm text-foreground">Weekly Schedule</p>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle each day on or off, then set your working hours.</p>
            </div>

            {availLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
            ) : (
              <>
                {/* Preset buttons */}
                <div className="p-4 pb-3 flex gap-2">
                  <button
                    onClick={() => applyPreset("weekends-off")}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border bg-muted/40 text-foreground border-border hover:bg-muted transition-colors"
                  >
                    Weekends Off
                  </button>
                  <button
                    onClick={() => applyPreset("weekdays-off")}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border bg-muted/40 text-foreground border-border hover:bg-muted transition-colors"
                  >
                    Weekdays Off
                  </button>
                  <button
                    onClick={() => applyPreset("all")}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border bg-muted/40 text-foreground border-border hover:bg-muted transition-colors"
                  >
                    All Available
                  </button>
                </div>

                {/* Per-day rows */}
                <div className="flex flex-col divide-y divide-border/40">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const isOn = !!availability[day];
                    const hours = availability[day] ?? { from: "08:00", until: "17:00" };
                    return (
                      <div key={day} className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => toggleDay(day)}
                          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none overflow-hidden ${
                            isOn ? "bg-primary" : "bg-border"
                          }`}
                        >
                          <span
                            className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200 ${
                              isOn ? "left-6" : "left-1"
                            }`}
                          />
                        </button>

                        <span className={`text-sm font-bold w-8 shrink-0 ${isOn ? "text-foreground" : "text-muted-foreground"}`}>
                          {DAYS[day]}
                        </span>

                        {isOn ? (
                          <div className="flex items-center gap-2 flex-1">
                            <select
                              value={hours.from}
                              onChange={(e) => setHour(day, "from", e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-ring/30"
                            >
                              {HOURS.map((h) => (
                                <option key={h.value} value={h.value}>{h.label}</option>
                              ))}
                            </select>
                            <span className="text-muted-foreground text-xs font-bold shrink-0">→</span>
                            <select
                              value={hours.until}
                              onChange={(e) => setHour(day, "until", e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-ring/30"
                            >
                              {HOURS.map((h) => (
                                <option key={h.value} value={h.value}>{h.label}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic flex-1">Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Save button */}
                <div className="p-4 pt-3">
                  <button
                    onClick={saveAvailability}
                    disabled={saving}
                    className={`w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                      saved ? "bg-[var(--color-status-completed)] text-white" : "bg-primary text-white hover:bg-primary/90"
                    }`}
                  >
                    {saving ? "Saving…" : saved ? "Saved!" : "Save Schedule"}
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground/60 text-center px-4 pb-2">
            Changes are visible to your manager immediately.
          </p>
        </div>
      )}
    </div>
  );
}
