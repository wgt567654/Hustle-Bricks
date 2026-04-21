"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";
import { STATUS_HEX } from "@/lib/status-colors";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  clients: { name: string } | null;
  job_line_items: { description: string }[];
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
  email: string | null;
};

type Availability = {
  id: string;
  team_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Client = {
  id: string;
  name: string;
};

type BookingRequest = {
  id: string;
  client_id: string;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  status: string;
  clients: { name: string; phone: string | null } | null;
};

const STATUS_COLORS = STATUS_HEX;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

function generateICS(jobs: Job[]) {
  const events = jobs
    .filter((j) => j.scheduled_at)
    .map((j) => {
      const start = new Date(j.scheduled_at!);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const title = j.job_line_items[0]?.description ?? "Service Job";
      const client = j.clients?.name ?? "";
      const dtStart = start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const dtEnd = end.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      return [
        "BEGIN:VEVENT",
        `UID:${j.id}@hustlebricks`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${title}${client ? ` — ${client}` : ""}`,
        `STATUS:${j.status === "completed" ? "COMPLETED" : "CONFIRMED"}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HustleBricks//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:HustleBricks Schedule",
    events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function makeGoogleCalendarUrl(job: Job) {
  if (!job.scheduled_at) return null;
  const start = new Date(job.scheduled_at);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const title = encodeURIComponent(
    `${job.job_line_items[0]?.description ?? "Service Job"}${job.clients?.name ? ` — ${job.clients.name}` : ""}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}`;
}

/**
 * Assigns side-by-side column positions to overlapping jobs so they render like Google Calendar.
 * Returns a map of jobId → { top, height, leftPct, widthPct }.
 * Jobs have no end time so a 60-minute default duration is assumed for overlap detection.
 */
function layoutJobs(jobs: Job[], hourHeight: number): Map<string, { top: number; height: number; leftPct: number; widthPct: number }> {
  const DEFAULT_DURATION = 60;
  const items = jobs
    .filter((j) => j.scheduled_at)
    .map((j) => {
      const d = new Date(j.scheduled_at!);
      const startMin = d.getHours() * 60 + d.getMinutes();
      return { job: j, startMin, endMin: startMin + DEFAULT_DURATION };
    })
    .sort((a, b) => a.startMin - b.startMin);

  // Greedy column assignment: each job gets the earliest free column
  const assignedCols: number[] = [];
  const colEnds: number[] = [];
  for (const item of items) {
    let col = colEnds.findIndex((end) => end <= item.startMin);
    if (col === -1) col = colEnds.length;
    assignedCols.push(col);
    colEnds[col] = item.endMin;
  }

  const result = new Map<string, { top: number; height: number; leftPct: number; widthPct: number }>();
  for (let i = 0; i < items.length; i++) {
    const { job, startMin, endMin } = items[i];
    // Collect all column indices of jobs that overlap with this one
    const overlapCols = items
      .map((o, j) => (o.startMin < endMin && o.endMin > startMin ? assignedCols[j] : -1))
      .filter((c) => c >= 0);
    const totalCols = Math.max(...overlapCols) + 1;
    result.set(job.id, {
      top: startMin * (hourHeight / 60),
      height: Math.max(DEFAULT_DURATION * (hourHeight / 60), 44),
      leftPct: (assignedCols[i] / totalCols) * 100,
      widthPct: 100 / totalCols,
    });
  }
  return result;
}

/** Generate hourly time slots between start and end (e.g. "08:00" to "17:00") */
function generateTimeSlots(startTime: string, endTime: string): string[] {
  const [startH] = startTime.split(":").map(Number);
  const [endH] = endTime.split(":").map(Number);
  const slots: string[] = [];
  for (let h = startH; h < endH; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

function formatSlotLabel(slot: string) {
  const [h, m] = slot.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`} ${suffix}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const [googleConnectedParam, setGoogleConnectedParam] = useState(false);
  const [googleErrorParam, setGoogleErrorParam] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setGoogleConnectedParam(p.get("google_connected") === "1");
    setGoogleErrorParam(p.get("google_error") === "1");
  }, []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [availTableMissing, setAvailTableMissing] = useState(false);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [bookingTableMissing, setBookingTableMissing] = useState(false);
  const [processingBooking, setProcessingBooking] = useState<string | null>(null);
  const [unavailDates, setUnavailDates] = useState<Set<string>>(new Set());
  const [togglingDate, setTogglingDate] = useState(false);
  const [schedulingSettings, setSchedulingSettings] = useState<{
    unavailable_days: number[];
    day_hours: Record<string, { from: string; until: string }>;
  }>({ unavailable_days: [], day_hours: {} });
  const [savingSettings, setSavingSettings] = useState(false);
  const [unavailMiniDate, setUnavailMiniDate] = useState(new Date());
  const [unavailDateInput, setUnavailDateInput] = useState("");
  const [tab, setTab] = useState<"calendar" | "unavailability" | "availability">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayViewMode, setDayViewMode] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const HOUR_HEIGHT = 64;

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalInviting, setGcalInviting] = useState(false);
  const [gcalInviteResult, setGcalInviteResult] = useState<{ invited: number; skipped: number } | null>(null);
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);

  // Schedule modal state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState<string | null>(null);
  const [scheduleClientId, setScheduleClientId] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [scheduleTotal, setScheduleTotal] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleAssignedIds, setScheduleAssignedIds] = useState<string[]>([]);
  const [scheduleSuccessJob, setScheduleSuccessJob] = useState<{ id: string; assignedMembers: TeamMember[] } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const bizId = await getBusinessId(supabase);
      if (!bizId) return;
      setBusinessId(bizId);

      // Fetch Google Calendar connection status
      fetch("/api/google-calendar/status")
        .then((r) => r.json())
        .then((d) => { setGcalConnected(d.connected); setGcalLoading(false); })
        .catch(() => setGcalLoading(false));

      const [{ data: jobsData }, { data: teamData }, availResult, { data: clientsData }, bookingResult, { data: blockedData }, { data: settingsData }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, clients(name), job_line_items(description)")
          .eq("business_id", bizId)
          .not("scheduled_at", "is", null)
          .order("scheduled_at"),
        supabase
          .from("team_members")
          .select("id, name, role, email")
          .eq("business_id", bizId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("worker_availability")
          .select("id, team_member_id, day_of_week, start_time, end_time")
          .eq("business_id", bizId),
        supabase
          .from("clients")
          .select("id, name")
          .eq("business_id", bizId)
          .order("name"),
        supabase
          .from("booking_requests")
          .select("id, client_id, requested_date, requested_time, notes, status, clients(name, phone)")
          .eq("business_id", bizId)
          .eq("status", "pending")
          .order("requested_date"),
        supabase
          .from("blocked_dates")
          .select("blocked_date")
          .eq("business_id", bizId),
        supabase
          .from("scheduling_settings")
          .select("unavailable_days, day_hours")
          .eq("business_id", bizId)
          .maybeSingle(),
      ]);

      setJobs((jobsData as unknown as Job[]) ?? []);
      setTeam(teamData ?? []);
      setClients(clientsData ?? []);

      if (availResult.error?.message?.includes("does not exist")) {
        setAvailTableMissing(true);
      } else {
        setAvailability(availResult.data ?? []);
      }

      if (bookingResult.error?.message?.includes("does not exist")) {
        setBookingTableMissing(true);
      } else {
        setBookingRequests((bookingResult.data as unknown as BookingRequest[]) ?? []);
      }

      if (blockedData) {
        setUnavailDates(new Set(blockedData.map((r: { blocked_date: string }) => r.blocked_date)));
      }
      if (settingsData) {
        setSchedulingSettings({
          unavailable_days: settingsData.unavailable_days ?? [],
          day_hours: settingsData.day_hours ?? {},
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  // Scroll day view to 6 AM when it opens or the selected day changes
  useEffect(() => {
    if (dayViewMode && timeGridRef.current) {
      timeGridRef.current.scrollTop = 6 * HOUR_HEIGHT;
    }
  }, [dayViewMode, selectedDay, HOUR_HEIGHT]);

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const jobsByDay = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (!job.scheduled_at) continue;
      const key = dateKey(new Date(job.scheduled_at));
      if (!map[key]) map[key] = [];
      map[key].push(job);
    }
    return map;
  }, [jobs]);

  const today = dateKey(new Date());

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
    setDayViewMode(false);
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
    setDayViewMode(false);
  }

  function exportICS() {
    const content = generateICS(jobs);
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hustlebricks-schedule.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function inviteAllToGcal() {
    setGcalInviting(true);
    setGcalInviteResult(null);
    try {
      const res = await fetch("/api/google-calendar/invite", { method: "POST" });
      const data = await res.json();
      setGcalInviteResult(data);
    } catch {
      // Swallow — non-critical
    }
    setGcalInviting(false);
  }

  async function disconnectGcal() {
    setGcalDisconnecting(true);
    await fetch("/api/google-calendar/disconnect", { method: "DELETE" }).catch(() => {});
    setGcalConnected(false);
    setGcalDisconnecting(false);
  }

  async function toggleAvailability(memberId: string, dayOfWeek: number) {
    if (!businessId || availTableMissing) return;
    setSavingAvail(true);
    const supabase = createClient();
    const existing = availability.find(
      (a) => a.team_member_id === memberId && a.day_of_week === dayOfWeek
    );
    if (existing) {
      await supabase.from("worker_availability").delete().eq("id", existing.id);
      setAvailability((prev) => prev.filter((a) => a.id !== existing.id));
    } else {
      const { data } = await supabase
        .from("worker_availability")
        .insert({
          business_id: businessId,
          team_member_id: memberId,
          day_of_week: dayOfWeek,
          start_time: "08:00",
          end_time: "17:00",
        })
        .select("id, team_member_id, day_of_week, start_time, end_time")
        .single();
      if (data) setAvailability((prev) => [...prev, data]);
    }
    setSavingAvail(false);
  }

  async function toggleUnavailDate(dateStr: string) {
    if (!businessId) return;
    setTogglingDate(true);
    const supabase = createClient();
    if (unavailDates.has(dateStr)) {
      await supabase.from("blocked_dates").delete().eq("business_id", businessId).eq("blocked_date", dateStr);
      setUnavailDates((prev) => { const next = new Set(prev); next.delete(dateStr); return next; });
    } else {
      await supabase.from("blocked_dates").insert({ business_id: businessId, blocked_date: dateStr });
      setUnavailDates((prev) => new Set([...prev, dateStr]));
    }
    setTogglingDate(false);
  }

  async function saveSchedulingSettings(updates: Partial<typeof schedulingSettings>) {
    if (!businessId) return;
    setSavingSettings(false);
    const next = { ...schedulingSettings, ...updates };
    setSchedulingSettings(next);
    const supabase = createClient();
    await supabase.from("scheduling_settings").upsert(
      { business_id: businessId, ...next },
      { onConflict: "business_id" }
    );
  }

  function toggleUnavailDay(day: number) {
    const days = schedulingSettings.unavailable_days;
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    saveSchedulingSettings({ unavailable_days: next });
  }

  function updateDayHours(day: number, from: string, until: string) {
    const next = { ...schedulingSettings.day_hours, [day]: { from, until } };
    saveSchedulingSettings({ day_hours: next });
  }

  function getDayHours(day: number) {
    return schedulingSettings.day_hours[day] ?? { from: "08:00", until: "18:00" };
  }

  const HOURS = Array.from({ length: 17 }, (_, i) => {
    const h = i + 6;
    const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;
    return { value: `${String(h).padStart(2, "0")}:00`, label };
  });

  async function confirmBooking(req: BookingRequest) {
    if (!businessId) return;
    setProcessingBooking(req.id);
    const supabase = createClient();

    const [h, m] = req.requested_time.split(":").map(Number);
    const scheduledAt = new Date(req.requested_date + "T12:00:00");
    scheduledAt.setHours(h, m, 0, 0);

    const { data: job } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        client_id: req.client_id,
        status: "scheduled",
        scheduled_at: scheduledAt.toISOString(),
        total: 0,
        notes: req.notes,
      })
      .select("id, status, total, scheduled_at, clients(name), job_line_items(description)")
      .single();

    await supabase
      .from("booking_requests")
      .update({ status: "confirmed" })
      .eq("id", req.id);

    setBookingRequests((prev) => prev.filter((r) => r.id !== req.id));
    if (job) {
      setJobs((prev) => [...prev, job as unknown as Job].sort((a, b) =>
        (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")
      ));
      // Sync to Google Calendar in the background
      fetch("/api/google-calendar/sync-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      }).catch(() => {});
      router.push(`/jobs/${job.id}`);
    }
    setProcessingBooking(null);
  }

  async function declineBooking(id: string) {
    setProcessingBooking(id);
    const supabase = createClient();
    await supabase.from("booking_requests").update({ status: "declined" }).eq("id", id);
    setBookingRequests((prev) => prev.filter((r) => r.id !== id));
    setProcessingBooking(null);
  }

  function openScheduleModal(dateStr: string, preTime?: string) {
    setScheduleDate(dateStr);
    setScheduleTime(preTime ?? null);
    setScheduleClientId("");
    setScheduleDescription("");
    setScheduleTotal("");
    setScheduleAssignedIds([]);
    setScheduleSuccessJob(null);
    setScheduleOpen(true);
  }

  async function saveScheduledJob() {
    if (!businessId || !scheduleDate || !scheduleTime) return;
    setScheduleSaving(true);

    const [h, m] = scheduleTime.split(":").map(Number);
    const scheduledAt = new Date(scheduleDate + "T12:00:00");
    scheduledAt.setHours(h, m, 0, 0);

    const assignedMembers = team.filter((t) => scheduleAssignedIds.includes(t.id));
    const primaryMemberId = scheduleAssignedIds[0] ?? null;

    const supabase = createClient();
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        client_id: scheduleClientId || null,
        status: "scheduled",
        scheduled_at: scheduledAt.toISOString(),
        total: parseFloat(scheduleTotal) || 0,
        notes: null,
        assigned_member_id: primaryMemberId,
      })
      .select("id")
      .single();

    if (!error && job && scheduleDescription) {
      await supabase.from("job_line_items").insert({
        job_id: job.id,
        description: scheduleDescription,
        quantity: 1,
        unit_price: parseFloat(scheduleTotal) || 0,
      });
    }

    // Save all crew members to job_crew table
    if (!error && job && scheduleAssignedIds.length > 0) {
      await supabase.from("job_crew").insert(
        scheduleAssignedIds.map((mid) => ({ job_id: job.id, team_member_id: mid }))
      );
    }

    setScheduleSaving(false);

    if (!error && job) {
      const { data: newJob } = await supabase
        .from("jobs")
        .select("id, status, total, scheduled_at, clients(name), job_line_items(description)")
        .eq("id", job.id)
        .single();
      if (newJob) {
        setJobs((prev) => [...prev, newJob as unknown as Job].sort((a, b) =>
          (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")
        ));
      }
      setScheduleSuccessJob({ id: job.id, assignedMembers });

      // Fire job assignment email in the background (non-blocking)
      if (primaryMemberId) {
        fetch("/api/email/job-assignment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        }).catch(() => {});
      }

      // Sync to Google Calendar in the background (non-blocking)
      fetch("/api/google-calendar/sync-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      }).catch(() => {});
    }
  }

  // Time slots for the selected schedule date
  const scheduleTimeSlots = useMemo(() => {
    if (!scheduleDate) return [];
    const dayOfWeek = new Date(scheduleDate + "T12:00:00").getDay();
    const dayAvail = availability.filter((a) => a.day_of_week === dayOfWeek);

    if (dayAvail.length === 0) {
      // Default 8am–6pm if no availability data
      return generateTimeSlots("08:00", "18:00");
    }

    // Union of all available windows for this day
    const allSlots = new Set<string>();
    for (const a of dayAvail) {
      for (const slot of generateTimeSlots(a.start_time, a.end_time)) {
        allSlots.add(slot);
      }
    }
    return Array.from(allSlots).sort();
  }, [scheduleDate, availability]);

  const selectedDayJobs = selectedDay ? (jobsByDay[selectedDay] ?? []) : [];
  const dayJobLayout = useMemo(() => layoutJobs(selectedDayJobs, HOUR_HEIGHT), [selectedDayJobs, HOUR_HEIGHT]);

  return (
    <div className="flex flex-col gap-0 max-w-xl mx-auto lg:max-w-none">
      {/* Header */}
      <div className="px-4 lg:px-8 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Calendar</h1>
            <p className="text-xs text-muted-foreground">Schedule & team availability.</p>
          </div>
          <button
            onClick={exportICS}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
            Export
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            { key: "calendar", label: "Schedule" },
            { key: "unavailability", label: "Unavailability" },
            { key: "availability", label: "Team" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                tab === t.key
                  ? "bg-primary text-white"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CALENDAR TAB — MONTH VIEW ── */}
      {tab === "calendar" && !dayViewMode && (
        <div className="flex flex-col gap-0 pb-40">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 lg:px-8 mb-3">
            <button
              onClick={prevMonth}
              className="flex size-9 items-center justify-center rounded-full bg-card border border-border text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <h2 className="text-lg font-extrabold tracking-tight text-foreground">
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="flex size-9 items-center justify-center rounded-full bg-card border border-border text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>

          {/* Booking requests */}
          {!bookingTableMissing && bookingRequests.length > 0 && (
            <div className="px-4 lg:px-8 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Booking Requests
                </p>
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] font-bold">
                  {bookingRequests.length} pending
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {bookingRequests.map((req) => {
                  const [h] = req.requested_time.split(":").map(Number);
                  const suffix = h >= 12 ? "PM" : "AM";
                  const hour = h % 12 === 0 ? 12 : h % 12;
                  const timeLabel = `${hour} ${suffix}`;
                  const dateLabel = new Date(req.requested_date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric",
                  });
                  const isProcessing = processingBooking === req.id;
                  return (
                    <div key={req.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-col gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                          <span className="material-symbols-outlined text-[18px] text-amber-700" style={{ fontVariationSettings: "'FILL' 1" }}>
                            calendar_clock
                          </span>
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-extrabold text-gray-900 text-sm leading-tight">
                            {req.clients?.name ?? "Unknown client"}
                          </span>
                          <span className="text-xs text-amber-700 font-medium mt-0.5">
                            {dateLabel} · {timeLabel}
                          </span>
                          {req.clients?.phone && (
                            <span className="text-xs text-gray-500 mt-0.5">{req.clients.phone}</span>
                          )}
                          {req.notes && (
                            <p className="text-xs text-gray-600 mt-1.5 bg-white rounded-lg px-2.5 py-1.5 border border-amber-100">
                              &ldquo;{req.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmBooking(req)}
                          disabled={!!processingBooking}
                          className="flex-1 py-2.5 rounded-xl bg-[var(--color-status-completed)] text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 active:scale-[0.98] transition-all"
                        >
                          {isProcessing ? "Confirming…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => declineBooking(req.id)}
                          disabled={!!processingBooking}
                          className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 disabled:opacity-50 active:scale-[0.98] transition-all"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-4 lg:px-8 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border/50 border-t border-b border-border/50">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = key === today;
              const isSelected = key === selectedDay;
              const isDateUnavail = unavailDates.has(key);
              const isDayUnavail = schedulingSettings.unavailable_days.includes(day.getDay());
              const isBlocked = isDateUnavail || isDayUnavail;
              const dayJobs = jobsByDay[key] ?? [];

              return (
                <button
                  key={key}
                  onClick={() => { setSelectedDay(key); setDayViewMode(true); }}
                  className={`relative flex flex-col items-center pt-1.5 pb-1 min-h-[52px] lg:min-h-[110px] transition-colors ${
                    isBlocked
                      ? "bg-red-50/60"
                      : isSelected
                      ? "bg-primary/5"
                      : "bg-background hover:bg-muted/30"
                  } ${!isCurrentMonth ? "opacity-35" : ""}`}
                >
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${
                      isToday
                        ? "bg-primary text-white"
                        : isBlocked
                        ? "bg-red-100 text-red-500 line-through"
                        : isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {isBlocked ? (
                    <span className="text-[8px] font-bold text-red-400 uppercase tracking-wide leading-none">closed</span>
                  ) : (
                    <div className="flex flex-col gap-0.5 w-full px-1 mt-1">
                      {dayJobs.slice(0, 3).map((job) => (
                        <div
                          key={job.id}
                          className="w-full h-1.5 lg:h-5 lg:rounded-md rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[job.status] }}
                        />
                      ))}
                      {dayJobs.length > 3 && (
                        <span className="text-[9px] font-bold text-muted-foreground text-center leading-none">
                          +{dayJobs.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-4 lg:px-8 mt-6 flex items-center gap-4 flex-wrap">
            {(["scheduled", "in_progress", "completed"] as JobStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                <span className="text-xs font-medium text-muted-foreground capitalize">{s.replace("_", " ")}</span>
              </div>
            ))}
          </div>

          {/* Google Calendar sync card */}
          <div className="mx-4 mt-4 p-3 rounded-2xl bg-primary/5 border border-primary/15">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  calendar_month
                </span>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <div>
                  <p className="font-bold text-sm text-foreground">Google Calendar</p>
                  {gcalConnected ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connected — new jobs sync automatically to your shared business calendar.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connect once and all jobs will sync automatically. Invite employees to view the shared calendar.
                    </p>
                  )}
                </div>

                {googleConnectedParam && (
                  <p className="text-xs font-bold text-[var(--color-status-completed)]">Connected successfully!</p>
                )}
                {googleErrorParam && (
                  <p className="text-xs font-bold text-red-500">Connection failed — please try again.</p>
                )}

                {gcalLoading ? null : gcalConnected ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={inviteAllToGcal}
                      disabled={gcalInviting}
                      className="w-full rounded-xl font-bold py-2.5 text-sm bg-primary text-white hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                      {gcalInviting ? "Sending invites…" : "Invite Team to Calendar"}
                    </button>
                    {gcalInviteResult && (
                      <p className="text-[11px] text-center text-muted-foreground">
                        Invited {gcalInviteResult.invited} member{gcalInviteResult.invited !== 1 ? "s" : ""}
                        {gcalInviteResult.skipped > 0 ? `, ${gcalInviteResult.skipped} skipped (no email)` : ""}
                      </p>
                    )}
                    <button
                      onClick={disconnectGcal}
                      disabled={gcalDisconnecting}
                      className="w-full rounded-xl font-bold py-2 text-xs bg-transparent border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition-all"
                    >
                      {gcalDisconnecting ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <a
                      href="/api/google-calendar/auth"
                      className="w-full rounded-xl font-bold py-2.5 text-sm bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all text-center block"
                    >
                      Connect Google Calendar
                    </a>
                    <button
                      onClick={exportICS}
                      className="w-full rounded-xl font-bold py-2 text-xs bg-transparent border border-border text-muted-foreground hover:bg-muted/50 transition-all"
                    >
                      Download .ics instead
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Client Booking CTA */}
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-status-completed/10 border border-[var(--color-status-completed)]/20">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl icon-green ">
                <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  link
                </span>
              </div>
              <div className="flex flex-col flex-1">
                <p className="font-bold text-sm text-foreground">Client Booking</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clients can schedule from their portal link. Go to a client and tap &ldquo;Portal&rdquo; to share.
                </p>
              </div>
              <Badge variant="secondary" className="icon-green  border-0 shrink-0 text-[10px]">
                Live
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* ── UNAVAILABILITY TAB ── */}
      {tab === "unavailability" && (
        <div className="px-4 lg:px-8 pb-40 lg:pb-8 flex flex-col gap-5">

          {/* Weekly Schedule (days off + hours combined) */}
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <p className="font-bold text-sm text-foreground">Weekly Schedule</p>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle each day on or off, then set working hours for available days.</p>
            </div>
            <div className="p-4 pb-3 flex flex-col gap-3">
              {/* Quick picks */}
              <div className="flex gap-2">
                <button
                  onClick={() => saveSchedulingSettings({ unavailable_days: [0, 6] })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    schedulingSettings.unavailable_days.includes(0) && schedulingSettings.unavailable_days.includes(6) && schedulingSettings.unavailable_days.length === 2
                      ? "bg-red-100 text-red-700 border-red-200"
                      : "bg-muted/40 text-foreground border-border hover:bg-muted"
                  }`}
                >
                  Weekends Off
                </button>
                <button
                  onClick={() => saveSchedulingSettings({ unavailable_days: [1, 2, 3, 4, 5] })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    schedulingSettings.unavailable_days.length === 5 && !schedulingSettings.unavailable_days.includes(0) && !schedulingSettings.unavailable_days.includes(6)
                      ? "bg-red-100 text-red-700 border-red-200"
                      : "bg-muted/40 text-foreground border-border hover:bg-muted"
                  }`}
                >
                  Weekdays Off
                </button>
                <button
                  onClick={() => saveSchedulingSettings({ unavailable_days: [] })}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border bg-muted/40 text-foreground border-border hover:bg-muted transition-colors"
                >
                  All Available
                </button>
              </div>
            </div>
            {/* Per-day rows */}
            <div className="flex flex-col divide-y divide-border/40">
              {DAYS.map((dayName, i) => {
                const isUnavail = schedulingSettings.unavailable_days.includes(i);
                const hours = getDayHours(i);
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleUnavailDay(i)}
                      disabled={savingSettings}
                      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none overflow-hidden ${
                        isUnavail ? "bg-border" : "bg-primary"
                      }`}
                      title={isUnavail ? "Mark as available" : "Mark as unavailable"}
                    >
                      <span
                        className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200 ${
                          isUnavail ? "left-1" : "left-6"
                        }`}
                      />
                    </button>
                    {/* Day name */}
                    <span className={`text-sm font-bold w-8 shrink-0 ${isUnavail ? "text-muted-foreground" : "text-foreground"}`}>{dayName}</span>
                    {/* Hours or Unavailable label */}
                    {isUnavail ? (
                      <span className="text-xs text-muted-foreground italic flex-1">Unavailable</span>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <select
                          value={hours.from}
                          onChange={(e) => updateDayHours(i, e.target.value, hours.until)}
                          className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-ring/30"
                        >
                          {HOURS.map((h) => (
                            <option key={h.value} value={h.value}>{h.label}</option>
                          ))}
                        </select>
                        <span className="text-muted-foreground text-xs font-bold shrink-0">→</span>
                        <select
                          value={hours.until}
                          onChange={(e) => updateDayHours(i, hours.from, e.target.value)}
                          className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-ring/30"
                        >
                          {HOURS.map((h) => (
                            <option key={h.value} value={h.value}>{h.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Specific Dates */}
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <p className="font-bold text-sm text-foreground">Specific Dates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Block holidays, vacations, or any one-off dates.</p>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {/* Quick date picker — click anywhere on the bar to open */}
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
                    await toggleUnavailDate(unavailDateInput);
                    setUnavailDateInput("");
                  }}
                  disabled={!unavailDateInput || togglingDate}
                  className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-40 transition-colors shrink-0"
                >
                  Block
                </button>
              </div>

              {/* Mini month nav */}
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
                  <div key={d} className="text-center text-[10px] font-bold uppercase text-muted-foreground py-1">{d.slice(0, 1)}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays(unavailMiniDate.getFullYear(), unavailMiniDate.getMonth()).map((day) => {
                  const key = dateKey(day);
                  const isThisMonth = day.getMonth() === unavailMiniDate.getMonth();
                  const isUnavail = unavailDates.has(key);
                  const todayStr = dateKey(new Date());
                  return (
                    <button
                      key={key}
                      onClick={() => isThisMonth && toggleUnavailDate(key)}
                      disabled={!isThisMonth || togglingDate}
                      className={`flex items-center justify-center h-9 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        isUnavail
                          ? "bg-red-500 text-white shadow-sm"
                          : key === todayStr
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
              {/* List of blocked dates */}
              {unavailDates.size > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unavailable Dates</p>
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {Array.from(unavailDates).sort().map((d) => (
                      <div key={d} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                        <span className="text-sm font-medium text-red-800">
                          {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <button
                          onClick={() => toggleUnavailDate(d)}
                          className="flex size-6 items-center justify-center rounded-full text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {unavailDates.size === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Tap any date above to mark it unavailable.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── AVAILABILITY TAB ── */}
      {tab === "availability" && (
        <div className="px-4 lg:px-8 pb-40 lg:pb-8 flex flex-col gap-4">
          {/* Setup notice if table missing */}
          {availTableMissing && (
            <div className="p-4 rounded-2xl bg-status-in-progress/10 border border-[var(--color-status-in-progress)]/20">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[var(--color-status-in-progress)] text-[20px] shrink-0 mt-0.5">info</span>
                <div>
                  <p className="font-bold text-sm text-foreground">Database setup needed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Run this SQL in your Supabase dashboard → SQL Editor:
                  </p>
                  <pre className="mt-2 text-[10px] bg-muted/50 rounded-lg p-3 overflow-x-auto text-foreground font-mono leading-relaxed whitespace-pre-wrap">
{`CREATE TABLE worker_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '17:00',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_member_id, day_of_week)
);
ALTER TABLE worker_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_manage_availability" ON worker_availability
  FOR ALL USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

          {!loading && team.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">group</span>
              <p className="text-sm font-medium text-muted-foreground">No team members yet</p>
              <button
                onClick={() => router.push("/team")}
                className="mt-1 text-sm font-bold text-primary hover:underline"
              >
                Add team members →
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground -mb-1">
            Tap the days each team member is available to work. Green = available.
          </p>

          {team.map((member) => {
            const memberAvail = availability.filter((a) => a.team_member_id === member.id);
            const availDays = new Set(memberAvail.map((a) => a.day_of_week));

            return (
              <Card key={member.id} className="rounded-2xl border-border shadow-sm overflow-hidden">
                <div className="p-4 flex items-center gap-3 border-b border-border/50">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-extrabold text-sm">
                    {member.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-foreground text-sm">{member.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-muted text-muted-foreground border-0 text-[10px]"
                  >
                    {availDays.size} day{availDays.size !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS.map((day, i) => {
                      const isAvail = availDays.has(i);
                      return (
                        <button
                          key={day}
                          onClick={() => toggleAvailability(member.id, i)}
                          disabled={savingAvail || availTableMissing}
                          className={`flex flex-col items-center justify-center rounded-xl py-2.5 gap-1 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                            isAvail
                              ? "bg-[var(--color-status-completed)] text-white shadow-sm"
                              : "bg-muted/40 text-muted-foreground border border-border hover:bg-muted"
                          }`}
                        >
                          <span>{day.slice(0, 1)}</span>
                          {isAvail && (
                            <span
                              className="material-symbols-outlined text-[12px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              check
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Weekly overview summary */}
          {!loading && team.length > 0 && !availTableMissing && (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <p className="font-bold text-sm text-foreground">Weekly Coverage</p>
                <p className="text-xs text-muted-foreground mt-0.5">How many people are available each day</p>
              </div>
              <div className="p-4 grid grid-cols-7 gap-1.5">
                {DAYS.map((day, i) => {
                  const count = availability.filter((a) => a.day_of_week === i).length;
                  const coverage = team.length > 0 ? count / team.length : 0;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{day.slice(0, 1)}</span>
                      <div className="w-full h-12 rounded-lg bg-muted/40 relative overflow-hidden">
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-lg transition-all"
                          style={{
                            height: `${Math.max(coverage * 100, count > 0 ? 15 : 0)}%`,
                            backgroundColor: coverage >= 0.75 ? "#16a34a" : coverage >= 0.4 ? "#ea580c" : coverage > 0 ? "#007AFF" : "transparent",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── CALENDAR TAB — DAY VIEW ── */}
      {tab === "calendar" && dayViewMode && selectedDay && (
        <div className="flex flex-col border-t border-border/30">
          {/* Day header */}
          <div className="flex items-center gap-2 px-4 lg:px-8 py-3 border-b border-border/50 shrink-0">
            <button
              onClick={() => setDayViewMode(false)}
              className="flex size-9 items-center justify-center rounded-full bg-card border border-border text-foreground hover:bg-muted/50 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex flex-col flex-1 min-w-0">
              {/* Shorter format on mobile, full on desktop */}
              <h2 className="text-base font-extrabold tracking-tight text-foreground leading-tight truncate">
                <span className="lg:hidden">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className="hidden lg:inline">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedDayJobs.length > 0
                  ? `${selectedDayJobs.length} job${selectedDayJobs.length !== 1 ? "s" : ""} scheduled`
                  : unavailDates.has(selectedDay) ? "Unavailable" : "Tap a time to add a job"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const d = new Date(selectedDay + "T12:00:00");
                  d.setDate(d.getDate() - 1);
                  const newKey = dateKey(d);
                  setSelectedDay(newKey);
                  if (d.getMonth() !== month) setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                className="flex size-8 items-center justify-center rounded-full bg-card border border-border text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button
                onClick={() => {
                  const d = new Date(selectedDay + "T12:00:00");
                  d.setDate(d.getDate() + 1);
                  const newKey = dateKey(d);
                  setSelectedDay(newKey);
                  if (d.getMonth() !== month) setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                className="flex size-8 items-center justify-center rounded-full bg-card border border-border text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
              {!unavailDates.has(selectedDay) && (
                <button
                  onClick={() => openScheduleModal(selectedDay)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span className="hidden sm:inline">Add Job</span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable time grid — dvh avoids mobile browser chrome issues */}
          <div
            ref={timeGridRef}
            className="overflow-y-auto pb-20 lg:pb-4"
            style={{ height: "calc(100dvh - 200px)" }}
          >
            <div className="relative flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
              {/* Hour labels */}
              <div className="w-14 lg:w-16 shrink-0 select-none">
                {Array.from({ length: 24 }, (_, h) => {
                  const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
                  return (
                    <div
                      key={h}
                      className="flex items-start justify-end pr-2 pt-1"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                      <span className="text-[10px] font-bold text-muted-foreground leading-none">{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Grid column */}
              <div className="flex-1 relative border-l border-border/40">
                {/* Clickable hour rows */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className={`border-b border-border/20 transition-colors ${
                      unavailDates.has(selectedDay) ? "cursor-default" : "cursor-pointer hover:bg-primary/5 active:bg-primary/10"
                    }`}
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    onClick={() => {
                      if (unavailDates.has(selectedDay)) return;
                      openScheduleModal(selectedDay, `${String(h).padStart(2, "0")}:00`);
                    }}
                  />
                ))}

                {/* Job blocks — side-by-side when overlapping */}
                {selectedDayJobs.map((job) => {
                  if (!job.scheduled_at) return null;
                  const layout = dayJobLayout.get(job.id);
                  if (!layout) return null;
                  const { top, height: blockHeight, leftPct, widthPct } = layout;
                  const start = new Date(job.scheduled_at);
                  const title = job.job_line_items[0]?.description ?? "Job";
                  const GAP = 3; // px gap between side-by-side blocks
                  return (
                    <div
                      key={job.id}
                      className="absolute rounded-xl overflow-hidden shadow-sm cursor-pointer hover:brightness-95 active:scale-[0.99] transition-all z-10 min-w-[60px]"
                      style={{
                        top: `${top}px`,
                        height: `${blockHeight}px`,
                        left: `calc(${leftPct}% + ${GAP}px)`,
                        width: `calc(${widthPct}% - ${GAP * 2}px)`,
                        backgroundColor: STATUS_COLORS[job.status],
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/jobs/${job.id}`);
                      }}
                    >
                      <div className="px-2.5 py-1.5 h-full flex flex-col justify-center gap-0.5">
                        <span className="text-white font-extrabold text-xs leading-tight truncate">{title}</span>
                        {job.clients?.name && blockHeight >= 52 && (
                          <span className="text-white/80 text-[10px] leading-tight truncate">{job.clients.name}</span>
                        )}
                        {blockHeight >= 60 && (
                          <span className="text-white/70 text-[10px] font-semibold">
                            {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${job.total.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Current time indicator (today only) */}
                {selectedDay === today && (() => {
                  const now = new Date();
                  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (HOUR_HEIGHT / 60);
                  return (
                    <div
                      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                      style={{ top: `${nowTop}px` }}
                    >
                      <div className="size-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5" />
                      <div className="flex-1 h-px bg-red-500" />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE MODAL ── */}
      {scheduleOpen && scheduleDate && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setScheduleOpen(false)}
          />
          {/* Bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[85vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 shrink-0">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">New Job</p>
                <h2 className="text-lg font-extrabold text-foreground leading-tight">
                  {new Date(scheduleDate + "T12:00:00").toLocaleDateString([], {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                </h2>
              </div>
              <button
                onClick={() => setScheduleOpen(false)}
                className="flex size-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

              {/* Existing jobs for this day */}
              {scheduleDate && (jobsByDay[scheduleDate] ?? []).length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Already Scheduled</label>
                  <div className="flex flex-col gap-1.5">
                    {(jobsByDay[scheduleDate] ?? []).map((job) => {
                      const time = job.scheduled_at
                        ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                        : "—";
                      return (
                        <div key={job.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/50">
                          <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[job.status] }} />
                          <span className="text-sm font-semibold text-foreground flex-1 truncate">
                            {job.job_line_items[0]?.description ?? "Job"}{job.clients?.name ? ` — ${job.clients.name}` : ""}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground shrink-0">{time}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Time slot picker */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pick a Time
                  {scheduleTimeSlots.length > 0 && !availTableMissing && availability.filter(
                    (a) => a.day_of_week === new Date(scheduleDate + "T12:00:00").getDay()
                  ).length > 0 && (
                    <span className="ml-1.5 text-[var(--color-status-completed)] normal-case font-normal">· based on team availability</span>
                  )}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {scheduleTimeSlots.map((slot) => {
                    const [slotH] = slot.split(":").map(Number);
                    const jobCount = (jobsByDay[scheduleDate!] ?? []).filter((job) => {
                      if (!job.scheduled_at) return false;
                      return new Date(job.scheduled_at).getHours() === slotH;
                    }).length;
                    return (
                      <button
                        key={slot}
                        onClick={() => setScheduleTime(slot === scheduleTime ? null : slot)}
                        className={`relative py-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex flex-col items-center gap-0.5 ${
                          scheduleTime === slot
                            ? "bg-primary text-white shadow-sm"
                            : jobCount > 0
                            ? "icon-orange border border-[var(--color-status-in-progress)]/20 hover:opacity-90"
                            : "bg-muted/50 text-foreground border border-border hover:bg-muted"
                        }`}
                      >
                        {formatSlotLabel(slot)}
                        {jobCount > 0 && (
                          <span className="text-[9px] font-bold opacity-80">
                            {jobCount} job{jobCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Client */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</label>
                <select
                  value={scheduleClientId}
                  onChange={(e) => setScheduleClientId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">No client selected</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Assign Crew */}
              {team.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assign Crew</label>
                    {scheduleAssignedIds.length > 0 && (
                      <span className="text-xs font-bold text-primary">{scheduleAssignedIds.length} selected</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {team.map((m) => {
                      const selected = scheduleAssignedIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setScheduleAssignedIds((prev) =>
                              prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                            )
                          }
                          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border text-left transition-all active:scale-[0.99] ${
                            selected
                              ? "border-primary bg-primary/8"
                              : "border-border bg-muted/30 hover:bg-muted/50"
                          }`}
                        >
                          <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                            selected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                          }`}>
                            {m.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className={`text-sm font-bold leading-tight ${selected ? "text-foreground" : "text-foreground"}`}>{m.name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                          </div>
                          {selected && (
                            <span className="material-symbols-outlined text-[18px] text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                              check_circle
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job Description</label>
                <input
                  type="text"
                  placeholder="e.g. Lawn mowing, Window cleaning…"
                  value={scheduleDescription}
                  onChange={(e) => setScheduleDescription(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              {/* Total */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job Total ($)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={scheduleTotal}
                  onChange={(e) => setScheduleTotal(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              {/* Spacer for bottom safe area */}
              <div className="h-2" />
            </div>

            {/* Footer CTA — or success screen */}
            {scheduleSuccessJob ? (
              <div className="px-5 py-6 border-t border-border/50 shrink-0 bg-background flex flex-col items-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-status-completed/10">
                  <span className="material-symbols-outlined text-[32px] text-[var(--color-status-completed)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                </div>
                <div>
                  <p className="font-extrabold text-foreground">Job Scheduled!</p>
                  {scheduleSuccessJob.assignedMembers.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Crew: {scheduleSuccessJob.assignedMembers.map((m) => m.name.split(" ")[0]).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {scheduleSuccessJob.assignedMembers.filter((m) => m.email).map((m) => (
                    <a
                      key={m.id}
                      href={`mailto:${m.email}?subject=You've been assigned a job&body=Hi ${m.name},%0A%0AYou've been assigned a new job. Log into your HustleBricks portal to see the details.`}
                      className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">mail</span>
                      Notify {m.name.split(" ")[0]}
                    </a>
                  ))}
                  <button
                    onClick={() => {
                      setScheduleOpen(false);
                      setScheduleSuccessJob(null);
                      router.push(`/jobs/${scheduleSuccessJob.id}`);
                    }}
                    className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
                  >
                    View Job
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background">
                <button
                  onClick={saveScheduledJob}
                  disabled={!scheduleTime || scheduleSaving}
                  className="w-full py-3.5 rounded-2xl bg-primary text-white font-extrabold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                >
                  {scheduleSaving ? "Scheduling…" : scheduleTime ? `Schedule at ${formatSlotLabel(scheduleTime)}` : "Pick a time above"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
