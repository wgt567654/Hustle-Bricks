"use client";

import { use, useEffect, useRef, useState } from "react";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";
import { formatCurrency } from "@/lib/currency";
import { getDefaultTemplate, interpolateTemplate } from "@/lib/messageTemplates";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "custom" | null;

type TeamMember = {
  id: string;
  name: string;
  email: string | null;
};

type AvailabilityStatus = "available" | "busy" | "off" | "unknown";


type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
};

const EXPENSE_CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "labor", label: "Labor" },
  { value: "fuel", label: "Fuel" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "other", label: "Other" },
];

const SERVICE_TYPES = [
  "Pressure Washing",
  "Window Cleaning",
  "Lawn Care",
  "Gutter Cleaning",
  "Landscaping",
  "Snow Removal",
  "House Cleaning",
  "Pest Control",
  "Pool Service",
  "Painting",
  "Other",
] as const;

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  service_type: string | null;
  recurrence_frequency: RecurrenceFrequency;
  recurrence_interval_days: number | null;
  business_id: string | null;
  client_id: string | null;
  quote_id: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  duration_mins: number | null;
  assigned_member_id: string | null;
  crew_size: number;
  clients: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  job_line_items: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  job_crew: { team_member_id: string; team_members: { id: string; name: string } | null }[];
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: "payments" },
  { value: "card", label: "Card", icon: "credit_card" },
  { value: "check", label: "Check", icon: "receipt" },
  { value: "venmo", label: "Venmo", icon: "phone_iphone" },
  { value: "zelle", label: "Zelle", icon: "phone_iphone" },
  { value: "other", label: "Other", icon: "more_horiz" },
];

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string; days: number }[] = [
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "biweekly", label: "Biweekly", days: 14 },
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "custom", label: "Custom", days: 0 },
];

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  custom: "Custom",
};

function formatScheduled(dateStr: string | null) {
  if (!dateStr) return "Not scheduled";
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) +
    " at " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const STATUS_BADGE: Record<JobStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-muted text-muted-foreground border-0" },
  in_progress: { label: "In Progress", className: "icon-orange  border-0" },
  completed: { label: "Completed", className: "icon-green  border-0" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-0" },
};

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [smsRemindersEnabled, setSmsRemindersEnabled] = useState(false);

  // Payment modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [autoScheduledDate, setAutoScheduledDate] = useState<string | null>(null);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editServiceType, setEditServiceType] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  // Send invoice
  const [invoiceSent, setInvoiceSent] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState<"before" | "after" | null>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category: "materials" });
  const [expenseSaving, setExpenseSaving] = useState(false);

  // Email invoice
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Recurring bottom sheet
  const [recurringSheetOpen, setRecurringSheetOpen] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<RecurrenceFrequency>(null);
  const [customDays, setCustomDays] = useState("7");
  const [recurringSaving, setRecurringSaving] = useState(false);

  // Assign employees modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [memberAvailability, setMemberAvailability] = useState<Record<string, AvailabilityStatus>>({});
  const [assignSaving, setAssignSaving] = useState(false);
  const [editDurationMins, setEditDurationMins] = useState<number | null>(null);
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [employeeSearch, setEmployeeSearch] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const bizId = await getBusinessId(supabase);
      if (!bizId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { data: bizData } = await supabase.from("businesses").select("currency, name, sms_reminders_enabled").eq("id", bizId).single();
      if (bizData?.currency) setCurrency(bizData.currency);
      if (bizData?.name) setBusinessName(bizData.name);
      setSmsRemindersEnabled((bizData as unknown as { sms_reminders_enabled: boolean } | null)?.sms_reminders_enabled ?? false);
      const fullName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "";
      setOwnerName(fullName);

      setBusinessId(bizId);

      const [{ data, error }, { data: expData }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, completed_at, notes, service_type, recurrence_frequency, recurrence_interval_days, business_id, client_id, quote_id, before_photo_url, after_photo_url, duration_mins, assigned_member_id, crew_size, clients(name, phone, email, address), job_line_items(id, description, quantity, unit_price), job_crew(team_member_id, team_members(id, name))")
          .eq("id", id)
          .eq("business_id", bizId)
          .single(),
        supabase
          .from("expenses")
          .select("id, description, amount, category, created_at")
          .eq("job_id", id)
          .order("created_at"),
      ]);

      if (error || !data) {
        setNotFound(true);
      } else {
        const jobData = data as unknown as Job;
        jobData.job_crew = jobData.job_crew ?? [];
        jobData.crew_size = jobData.crew_size ?? 1;
        setJob(jobData);
        setPayAmount(String((data as unknown as Job).total.toFixed(2)));
        setExpenses((expData as unknown as Expense[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function updateStatus(status: JobStatus) {
    if (!job) return;
    setUpdating(true);
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === "completed") updates.completed_at = new Date().toISOString();

    await supabase.from("jobs").update(updates).eq("id", job.id);
    setJob((j) => j ? { ...j, status, completed_at: status === "completed" ? new Date().toISOString() : j.completed_at } : j);
    setUpdating(false);

    // Sync status change to Google Calendar in the background
    fetch("/api/google-calendar/sync-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(() => {});

    if (status === "completed") {
      // Auto-schedule next recurring job if applicable
      if (job.recurrence_frequency && job.recurrence_interval_days) {
        const baseDate = job.scheduled_at ?? new Date().toISOString();
        const nextDate = addDays(baseDate, job.recurrence_interval_days);

        try {
          const { data: newJob } = await supabase
            .from("jobs")
            .insert({
              business_id: job.business_id,
              client_id: job.client_id,
              quote_id: job.quote_id ?? null,
              total: job.total,
              notes: job.notes,
              recurrence_frequency: job.recurrence_frequency,
              recurrence_interval_days: job.recurrence_interval_days,
              status: "scheduled",
              scheduled_at: nextDate,
            })
            .select("id")
            .single();

          if (newJob?.id && job.job_line_items.length > 0) {
            await supabase.from("job_line_items").insert(
              job.job_line_items.map((item) => ({
                job_id: newJob.id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
              }))
            );
          }

          setAutoScheduledDate(nextDate);
        } catch {
          // Non-critical — swallow error and continue
        }
      }

      setPayModalOpen(true);
    } else if (status === "cancelled") {
      router.push("/jobs");
    }
  }

  function openEditModal() {
    if (!job) return;
    if (job.scheduled_at) {
      const d = new Date(job.scheduled_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setEditScheduledAt(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    } else {
      setEditScheduledAt("");
    }
    setEditNotes(job.notes ?? "");
    setEditServiceType(job.service_type ?? "");
    setEditModalOpen(true);
  }

  async function saveJobEdits() {
    if (!job) return;
    setEditSaving(true);
    const supabase = createClient();
    const updates: { scheduled_at?: string | null; notes?: string | null; service_type?: string | null } = {
      notes: editNotes || null,
      service_type: editServiceType || null,
    };
    if (editScheduledAt) {
      updates.scheduled_at = new Date(editScheduledAt).toISOString();
    } else {
      updates.scheduled_at = null;
    }
    await supabase.from("jobs").update(updates).eq("id", job.id);
    setJob((j) =>
      j
        ? {
            ...j,
            scheduled_at: updates.scheduled_at ?? null,
            notes: updates.notes ?? null,
            service_type: updates.service_type ?? null,
          }
        : j
    );

    // Sync schedule change to Google Calendar in the background
    fetch("/api/google-calendar/sync-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(() => {});

    setEditSaving(false);
    setEditModalOpen(false);
  }

  async function collectPayment() {
    if (!job || !businessId) return;
    setPaySaving(true);
    const supabase = createClient();

    await supabase.from("payments").insert({
      business_id: businessId,
      job_id: job.id,
      amount: parseFloat(payAmount) || job.total,
      status: "paid",
      paid_at: new Date().toISOString(),
      method: payMethod,
      notes: payNotes || null,
    });

    setPaySaving(false);
    setPayModalOpen(false);
    router.push("/payments");
  }

  async function saveRecurrence() {
    if (!job || !selectedFrequency) return;
    setRecurringSaving(true);

    const intervalDays =
      selectedFrequency === "custom"
        ? parseInt(customDays, 10) || 7
        : FREQUENCY_OPTIONS.find((f) => f.value === selectedFrequency)?.days ?? 7;

    const supabase = createClient();
    await supabase
      .from("jobs")
      .update({
        recurrence_frequency: selectedFrequency,
        recurrence_interval_days: intervalDays,
      })
      .eq("id", job.id);

    setJob((j) =>
      j
        ? {
            ...j,
            recurrence_frequency: selectedFrequency,
            recurrence_interval_days: intervalDays,
          }
        : j
    );
    setRecurringSaving(false);
    setRecurringSheetOpen(false);
  }

  async function addExpense() {
    if (!job || !businessId || !expenseForm.description || !expenseForm.amount) return;
    setExpenseSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("expenses")
      .insert({
        job_id: job.id,
        business_id: businessId,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
      })
      .select("id, description, amount, category, created_at")
      .single();
    if (data) setExpenses((prev) => [...prev, data as Expense]);
    setExpenseForm({ description: "", amount: "", category: "materials" });
    setShowAddExpense(false);
    setExpenseSaving(false);
  }

  async function deleteExpense(expenseId: string) {
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", expenseId);
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
  }

  async function sendInvoiceEmail() {
    if (!job?.clients?.email) return;
    setEmailSending(true);
    const res = await fetch("/api/email/send-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    });
    setEmailSending(false);
    if (res.ok) {
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to send email: ${data.error ?? "Unknown error"}`);
    }
  }

  async function sendInvoice() {
    if (!job?.clients?.phone || !businessId) return;
    const clientName = job.clients.name;
    const ownerNameVar = ownerName || businessName;
    const svcType = job.service_type ?? "Other";
    const messageType = job.scheduled_at ? "confirmation" : "post_quote";

    const supabase = createClient();
    const { data } = await supabase
      .from("message_templates")
      .select("body")
      .eq("business_id", businessId)
      .eq("service_type", svcType)
      .eq("message_type", messageType)
      .maybeSingle();

    const templateBody = (data as { body: string } | null)?.body ?? getDefaultTemplate(svcType, messageType);
    const vars: Record<string, string> = { clientName, ownerName: ownerNameVar, bizName: businessName };

    if (job.scheduled_at) {
      const d = new Date(job.scheduled_at);
      vars.date = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
      vars.time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    const body = interpolateTemplate(templateBody, vars);
    window.location.href = `sms:${job.clients.phone}?body=${encodeURIComponent(body)}`;
    setInvoiceSent(true);
    setTimeout(() => setInvoiceSent(false), 3000);
  }

  async function handlePhotoUpload(file: File, slot: "before" | "after") {
    if (!job) return;
    setUploadingPhoto(slot);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${job.id}/${slot}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from("job-photos").getPublicUrl(path);
      const column = slot === "before" ? "before_photo_url" : "after_photo_url";
      await supabase.from("jobs").update({ [column]: publicUrl }).eq("id", job.id);
      setJob((j) => j ? { ...j, [column]: publicUrl } : j);
    }
    setUploadingPhoto(null);
  }

  async function cancelRecurrence() {
    if (!job) return;
    const supabase = createClient();
    await supabase
      .from("jobs")
      .update({ recurrence_frequency: null, recurrence_interval_days: null })
      .eq("id", job.id);
    setJob((j) =>
      j ? { ...j, recurrence_frequency: null, recurrence_interval_days: null } : j
    );
  }

  async function computeAvailability(
    members: TeamMember[],
    durationMins: number | null,
  ): Promise<Record<string, AvailabilityStatus>> {
    if (!job?.scheduled_at || !durationMins) {
      return Object.fromEntries(members.map((m) => [m.id, "unknown"]));
    }

    const jobStart = new Date(job.scheduled_at);
    const jobEnd = new Date(jobStart.getTime() + durationMins * 60_000);
    const dayOfWeek = jobStart.getDay();
    const pad = (n: number) => String(n).padStart(2, "0");
    const startHHMM = `${pad(jobStart.getHours())}:${pad(jobStart.getMinutes())}`;
    const endHHMM = `${pad(jobEnd.getHours())}:${pad(jobEnd.getMinutes())}`;

    const supabase = createClient();

    const [{ data: avail }, { data: conflictJobs }] = await Promise.all([
      supabase
        .from("employee_availability")
        .select("team_member_id, from_time, until_time")
        .eq("business_id", businessId)
        .eq("day_of_week", dayOfWeek),
      supabase
        .from("jobs")
        .select("id, assigned_member_id, job_crew(team_member_id)")
        .eq("business_id", businessId)
        .neq("id", job.id)
        .in("status", ["scheduled", "in_progress"])
        .not("scheduled_at", "is", null)
        .lt("scheduled_at", jobEnd.toISOString())
        .gt("scheduled_at", jobStart.toISOString()),
    ]);

    const busyIds = new Set<string>();
    for (const cj of conflictJobs ?? []) {
      if (cj.assigned_member_id) busyIds.add(cj.assigned_member_id);
      for (const crew of (cj.job_crew as { team_member_id: string }[]) ?? []) {
        busyIds.add(crew.team_member_id);
      }
    }

    const availMap = new Map((avail ?? []).map((a) => [a.team_member_id, a]));

    return Object.fromEntries(
      members.map((m) => {
        if (busyIds.has(m.id)) return [m.id, "busy" as AvailabilityStatus];
        const a = availMap.get(m.id);
        if (!a) return [m.id, "off" as AvailabilityStatus];
        if (a.from_time > startHHMM || a.until_time < endHHMM) return [m.id, "off" as AvailabilityStatus];
        return [m.id, "available" as AvailabilityStatus];
      })
    );
  }

  function sortMembers(members: TeamMember[], avail: Record<string, AvailabilityStatus>): TeamMember[] {
    const priority = (s: AvailabilityStatus) => {
      if (s === "available") return 0;
      if (s === "unknown") return 1;
      return 2; // busy or off
    };
    return [...members].sort((a, b) => {
      const pd = priority(avail[a.id] ?? "unknown") - priority(avail[b.id] ?? "unknown");
      if (pd !== 0) return pd;
      return a.name.localeCompare(b.name);
    });
  }

  async function openAssignModal() {
    if (!job || !businessId) return;
    const supabase = createClient();
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name, email")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name");

    const memberList = (members ?? []) as TeamMember[];

    const currentIds = job.job_crew.map((jc) => jc.team_member_id);
    setAssignedIds(currentIds);

    const duration = job.duration_mins ?? null;
    setEditDurationMins(duration);
    setDurationHours(duration ? Math.floor(duration / 60) : 0);
    setDurationMinutes(duration ? duration % 60 : 0);
    setEmployeeSearch("");

    const avail = await computeAvailability(memberList, duration);
    setMemberAvailability(avail);
    setTeamMembers(sortMembers(memberList, avail));

    setAssignModalOpen(true);
  }

  async function handleDurationInputChange(hours: number, minutes: number) {
    const total = hours * 60 + minutes;
    const mins = total > 0 ? total : null;
    setEditDurationMins(mins);
    if (teamMembers.length > 0) {
      const avail = await computeAvailability(teamMembers, mins);
      setMemberAvailability(avail);
      setTeamMembers((prev) => sortMembers(prev, avail));
    }
  }

  async function saveAssignment() {
    if (!job) return;

    const hasUnavailable = assignedIds.some((id) => {
      const s = memberAvailability[id];
      return s === "busy" || s === "off";
    });
    if (hasUnavailable) {
      const confirmed = window.confirm(
        "One or more employees may not be available at this time. Assign anyway?"
      );
      if (!confirmed) return;
    }

    setAssignSaving(true);
    const supabase = createClient();
    const primaryId = assignedIds[0] ?? null;

    await supabase.from("jobs").update({
      assigned_member_id: primaryId,
      crew_size: assignedIds.length || 1,
      duration_mins: editDurationMins,
    }).eq("id", job.id);

    await supabase.from("job_crew").delete().eq("job_id", job.id);

    if (assignedIds.length > 0) {
      await supabase.from("job_crew").insert(
        assignedIds.map((mid) => ({ job_id: job.id, team_member_id: mid }))
      );
    }

    const newCrewEntries = teamMembers
      .filter((m) => assignedIds.includes(m.id))
      .map((m) => ({ team_member_id: m.id, team_members: { id: m.id, name: m.name } }));

    setJob((j) =>
      j
        ? {
            ...j,
            assigned_member_id: primaryId,
            crew_size: assignedIds.length || 1,
            duration_mins: editDurationMins,
            job_crew: newCrewEntries,
          }
        : j
    );

    if (primaryId) {
      fetch("/api/email/job-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      }).catch(() => {});
    }

    fetch("/api/google-calendar/sync-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(() => {});

    setAssignSaving(false);
    setAssignModalOpen(false);
    setEmployeeSearch("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading job…</p>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="font-bold text-foreground">Job not found</p>
        <button onClick={() => router.push("/jobs")} className="text-sm text-primary font-bold">← Back to Jobs</button>
      </div>
    );
  }

  const badge = STATUS_BADGE[job.status];
  const title = job.job_line_items[0]?.description ?? "Job";
  const extraItems = job.job_line_items.length - 1;

  // Compute next scheduled date for display
  const nextScheduledDate =
    job.recurrence_frequency && job.recurrence_interval_days && job.scheduled_at
      ? addDays(job.scheduled_at, job.recurrence_interval_days)
      : null;

  const swipeEdit = useSwipeToDismiss(() => setEditModalOpen(false), editModalOpen);
  const swipeRecurring = useSwipeToDismiss(() => setRecurringSheetOpen(false), recurringSheetOpen);
  const swipeAssign = useSwipeToDismiss(() => { setAssignModalOpen(false); setEmployeeSearch(""); }, assignModalOpen);
  const swipePay = useSwipeToDismiss(() => setPayModalOpen(false), payModalOpen);

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-52 lg:pb-48">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.push("/jobs")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="flex flex-col flex-1">
          <Badge variant="secondary" className={`w-fit mb-1 max-h-5 px-2 text-[10px] uppercase font-bold tracking-wider ${badge.className}`}>
            {badge.label}
          </Badge>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-tight">
            {title}{extraItems > 0 ? ` +${extraItems} more` : ""}
          </h1>
        </div>
        {(job.status === "scheduled" || job.status === "in_progress") && (
          <button
            onClick={openEditModal}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
          </button>
        )}
      </div>

      {/* 48hr SMS reminder prompt */}
      {(() => {
        if (!smsRemindersEnabled || !job.scheduled_at || !job.clients?.phone) return null;
        const now = Date.now();
        const scheduled = new Date(job.scheduled_at).getTime();
        const hoursUntil = (scheduled - now) / (1000 * 60 * 60);
        if (hoursUntil < 0 || hoursUntil > 48) return null;
        const ownerFirst = ownerName.split(" ")[0] || businessName;
        const d = new Date(job.scheduled_at);
        const date = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const msg =
          `Hi ${job.clients.name}, this is ${ownerFirst} from ${businessName}.\n\n` +
          `Just a quick reminder that you're scheduled for service tomorrow on ${date} at ${time}. We're looking forward to taking care of this for you!\n\n` +
          `If you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.`;
        return (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <span className="material-symbols-outlined text-[22px] text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
            <div className="flex flex-col flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Send a reminder to {job.clients.name}</p>
              <p className="text-xs text-muted-foreground">This job is coming up — tap to pre-fill an SMS.</p>
            </div>
            <a
              href={`sms:${job.clients.phone}?body=${encodeURIComponent(msg)}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold shrink-0 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">sms</span>
              Send
            </a>
          </div>
        );
      })()}

      {/* Two-column body on desktop */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">

      {/* ── Left column: job info + line items + expenses ── */}
      <div className="flex flex-col gap-6 lg:flex-[3]">

      {/* Details card */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col gap-4">

          {/* Client */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Client</span>
              <span className="text-sm font-bold text-foreground">{job.clients?.name ?? "—"}</span>
              {job.clients?.email && <span className="text-xs text-muted-foreground">{job.clients.email}</span>}
            </div>
            <div className="flex items-center gap-2">
              {job.clients?.phone && (
                <a
                  href={`tel:${job.clients.phone}`}
                  className="flex size-8 items-center justify-center rounded-full icon-green  hover:opacity-90 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                </a>
              )}
              {job.clients?.phone && (
                <button
                  onClick={sendInvoice}
                  className={`flex size-8 items-center justify-center rounded-full transition-colors ${invoiceSent ? "icon-green " : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                  title={invoiceSent ? "Message opened!" : "Send confirmation SMS"}
                >
                  <span className="material-symbols-outlined text-[16px]">{invoiceSent ? "check" : "sms"}</span>
                </button>
              )}
              {job.clients?.email && (
                <button
                  onClick={sendInvoiceEmail}
                  disabled={emailSending}
                  className={`flex size-8 items-center justify-center rounded-full transition-colors ${emailSent ? "icon-green " : "icon-orange  hover:opacity-90"} disabled:opacity-50`}
                  title={emailSent ? "Invoice sent!" : "Email invoice"}
                >
                  <span className="material-symbols-outlined text-[16px]">{emailSent ? "check" : emailSending ? "progress_activity" : "mail"}</span>
                </button>
              )}
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Location */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[20px]">location_on</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Location</span>
              <span className="text-sm font-bold text-foreground leading-snug">
                {job.clients?.address ?? "No address on file"}
              </span>
            </div>
            {job.clients?.address && (
              <a
                href={`https://maps.apple.com/?q=${encodeURIComponent(job.clients.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">navigation</span>
              </a>
            )}
          </div>

          <Separator className="bg-border/50" />

          {/* Schedule */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Scheduled</span>
              <span className="text-sm font-bold text-foreground">{formatScheduled(job.scheduled_at)}</span>
            </div>
            {!job.scheduled_at && (job.status === "scheduled" || job.status === "in_progress") && (
              <button
                onClick={openEditModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 active:scale-95 transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Schedule
              </button>
            )}
          </div>

        </div>

        {/* Notes */}
        {job.notes && (
          <div className="bg-status-in-progress/10 p-4 border-t border-[var(--color-status-in-progress)]/20 flex gap-3">
            <span className="material-symbols-outlined text-[var(--color-status-in-progress)] text-[20px] shrink-0 mt-0.5">sticky_note_2</span>
            <p className="text-sm text-[var(--color-status-in-progress)] font-medium leading-relaxed">{job.notes}</p>
          </div>
        )}
      </Card>

      {/* Crew card */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">group</span>
            Crew
          </h3>
          <button
            onClick={openAssignModal}
            className="text-xs font-bold text-primary flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined text-[14px]">{job.job_crew.length > 0 ? "edit" : "add"}</span>
            {job.job_crew.length > 0 ? "Edit" : "Assign"}
          </button>
        </div>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          {job.job_crew.length === 0 ? (
            <button
              onClick={openAssignModal}
              className="w-full p-4 flex items-center gap-3 text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <span className="material-symbols-outlined text-[20px]">person_add</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-foreground">No employees assigned</span>
                <span className="text-xs text-muted-foreground">Tap to assign crew to this job</span>
              </div>
            </button>
          ) : (
            <div className="divide-y divide-border/50">
              {job.job_crew.map((jc, i) => (
                <div key={jc.team_member_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-extrabold">
                    {(jc.team_members?.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-foreground flex-1">{jc.team_members?.name ?? "Unknown"}</span>
                  {i === 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Lead</span>
                  )}
                </div>
              ))}
              {job.duration_mins && (
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
                  <span className="material-symbols-outlined text-[16px] text-muted-foreground">timer</span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {(() => {
                      const h = Math.floor(job.duration_mins / 60);
                      const m = job.duration_mins % 60;
                      return [h > 0 ? `${h} hr${h > 1 ? "s" : ""}` : null, m > 0 ? `${m} min` : null].filter(Boolean).join(" ");
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* Line items */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Line Items</h3>
          <span className="font-extrabold text-foreground">{formatCurrency(job.total, currency)}</span>
        </div>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          {job.job_line_items.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <Separator className="bg-border/50 mx-4" />}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] text-[var(--color-status-completed)]">check_circle</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{item.description}</span>
                    {item.quantity > 1 && (
                      <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                    )}
                  </div>
                </div>
                <span className="font-bold text-sm text-foreground">
                  {formatCurrency(item.unit_price * item.quantity, currency)}
                </span>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* ── EXPENSES & PROFIT ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            Expenses &amp; Profit
          </h3>
          <button
            onClick={() => setShowAddExpense((v) => !v)}
            className="text-xs font-bold text-primary flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined text-[14px]">{showAddExpense ? "remove" : "add"}</span>
            Add
          </button>
        </div>

        {/* Profit margin summary */}
        {(() => {
          const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
          const profit = job.total - totalExpenses;
          const margin = job.total > 0 ? (profit / job.total) * 100 : 0;
          return (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</span>
                <span className="text-base font-extrabold text-foreground">{formatCurrency(job.total, currency)}</span>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expenses</span>
                <span className="text-base font-extrabold text-[var(--color-status-in-progress)]">{formatCurrency(totalExpenses, currency)}</span>
              </div>
              <div className={`rounded-2xl border p-3 flex flex-col gap-0.5 ${profit >= 0 ? "border-[var(--color-status-completed)]/20 bg-status-completed/10" : "border-destructive/30 bg-destructive/5"}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Profit</span>
                <span className={`text-base font-extrabold ${profit >= 0 ? "text-[var(--color-status-completed)]" : "text-destructive"}`}>
                  {formatCurrency(profit, currency)}
                </span>
                <span className="text-[9px] font-bold text-muted-foreground">{margin.toFixed(0)}% margin</span>
              </div>
            </div>
          );
        })()}

        {/* Add expense form */}
        {showAddExpense && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mb-3 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                className="flex-1 text-sm rounded-xl border border-border bg-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-24 text-sm rounded-xl border border-border bg-background pl-6 pr-2 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setExpenseForm((f) => ({ ...f, category: cat.value }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${expenseForm.category === cat.value ? "bg-primary text-white" : "bg-muted text-foreground border border-border hover:bg-muted/80"}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <button
              onClick={addExpense}
              disabled={expenseSaving || !expenseForm.description || !expenseForm.amount}
              className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {expenseSaving ? "Saving…" : "Save Expense"}
            </button>
          </div>
        )}

        {/* Expense list */}
        {expenses.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {expenses.map((exp, i) => (
              <div key={exp.id}>
                {i > 0 && <Separator className="bg-border/50 mx-4" />}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">{exp.description}</span>
                    <span className="text-xs text-muted-foreground capitalize">{exp.category}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-[var(--color-status-in-progress)]">{formatCurrency(Number(exp.amount), currency)}</span>
                    <button
                      onClick={() => deleteExpense(exp.id)}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {expenses.length === 0 && !showAddExpense && (
          <button
            onClick={() => setShowAddExpense(true)}
            className="w-full py-6 rounded-2xl border border-dashed border-border text-muted-foreground text-sm flex items-center justify-center gap-2 hover:border-primary/40 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Log an expense
          </button>
        )}
      </section>

      </div>{/* end left column */}

      {/* ── Right column: recurring + photos ── */}
      <div className="flex flex-col gap-6 lg:flex-[2]">

      {/* ── RECURRING SECTION ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">autorenew</span>
            Recurring
          </h3>
        </div>

        {job.recurrence_frequency ? (
          /* Active recurring card */
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>autorenew</span>
                </div>
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Recurring job</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] uppercase font-bold tracking-wider">
                      {FREQUENCY_LABELS[job.recurrence_frequency] ?? job.recurrence_frequency}
                    </Badge>
                  </div>
                  {nextScheduledDate && (
                    <span className="text-xs text-muted-foreground mt-0.5">
                      Next job scheduled for {formatDateShort(nextScheduledDate)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={cancelRecurrence}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-muted-foreground border border-border bg-muted/30 hover:bg-muted transition-colors"
              >
                Cancel Recurring
              </button>
            </div>
          </Card>
        ) : (
          /* Make recurring CTA card */
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <span className="material-symbols-outlined text-[20px]">autorenew</span>
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-sm font-bold text-foreground">One-time job</span>
                <span className="text-xs text-muted-foreground">Turn this into a repeating job</span>
              </div>
              <button
                onClick={() => {
                  setSelectedFrequency(null);
                  setCustomDays("7");
                  setRecurringSheetOpen(true);
                }}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 active:scale-95 transition-all"
              >
                Make Recurring
              </button>
            </div>
          </Card>
        )}
      </section>

      {/* Photo documentation */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <span className="material-symbols-outlined text-[16px]">photo_camera</span>
          Job Documentation
        </h3>
        <input ref={beforeInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, "before"); e.target.value = ""; }} />
        <input ref={afterInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, "after"); e.target.value = ""; }} />
        <div className="grid grid-cols-2 gap-3">
          {(["before", "after"] as const).map((slot) => {
            const photoUrl = slot === "before" ? job.before_photo_url : job.after_photo_url;
            const inputRef = slot === "before" ? beforeInputRef : afterInputRef;
            const isUploading = uploadingPhoto === slot;
            return (
              <button
                key={slot}
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="relative flex flex-col rounded-2xl overflow-hidden border border-dashed border-border bg-card/50 items-center justify-center min-h-[140px] transition-colors hover:border-primary/50 hover:bg-muted/30 disabled:opacity-60 active:scale-[0.98]"
              >
                {photoUrl ? (
                  <>
                    <img src={photoUrl} alt={slot} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-white text-[22px]">photo_camera</span>
                      <span className="text-white text-xs font-bold mt-1">Replace</span>
                    </div>
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wider text-white bg-black/50 px-2 py-0.5 rounded-full capitalize">{slot}</span>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 items-center justify-center text-muted-foreground p-4">
                    {isUploading
                      ? <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                      : <span className="material-symbols-outlined text-[24px]">add_a_photo</span>
                    }
                    <span className="font-bold text-sm capitalize">{isUploading ? "Uploading…" : slot}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      </div>{/* end right column */}
      </div>{/* end two-column body */}

      {/* Completed — show collect payment prompt if no modal */}
      {job.status === "completed" && !payModalOpen && (
        <div className="fixed bottom-0 left-0 lg:left-[60px] w-full lg:w-[calc(100%-60px)] z-50 bg-card border-t border-border px-4 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}>
          <div className="max-w-xl mx-auto lg:max-w-none lg:max-w-3xl flex gap-3">
            <button
              onClick={() => setPayModalOpen(true)}
              className="flex-[2] rounded-xl font-bold py-4 text-sm bg-[var(--color-status-completed)] text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">attach_money</span>
              Collect Payment
            </button>
            <button
              onClick={() => router.push("/jobs")}
              className="flex-1 rounded-xl font-bold py-4 text-sm bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      {(job.status === "scheduled" || job.status === "in_progress") && (
        <div className="fixed bottom-0 left-0 lg:left-[60px] w-full lg:w-[calc(100%-60px)] z-50 bg-card border-t border-border px-4 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}>
          <div className="max-w-xl mx-auto lg:max-w-none lg:max-w-3xl flex gap-3">
            {job.status === "scheduled" && (
              <button
                onClick={() => updateStatus("in_progress")}
                disabled={updating}
                className="flex-[2] rounded-xl font-bold py-4 text-sm bg-[var(--color-status-in-progress)] text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">play_circle</span>
                {updating ? "Starting…" : "Start Job"}
              </button>
            )}
            {job.status === "in_progress" && (
              <>
                <button
                  onClick={() => updateStatus("cancelled")}
                  disabled={updating}
                  className="flex-1 rounded-xl font-bold py-4 text-sm bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateStatus("completed")}
                  disabled={updating}
                  className="flex-[2] rounded-xl font-bold py-4 text-sm bg-[var(--color-status-completed)] text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">task_alt</span>
                  {updating ? "Completing…" : "Complete Job"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT JOB MODAL ── */}
      {editModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditModalOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden" ref={swipeEdit.sheetRef} {...swipeEdit.sheetDragProps}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <span className="material-symbols-outlined text-[28px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    edit_calendar
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground leading-tight">Edit Job</h2>
                  <p className="text-sm text-muted-foreground">Update schedule and notes</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

              {/* Scheduled date/time */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              {/* Service Type */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service Type</label>
                <select
                  value={editServiceType}
                  onChange={(e) => setEditServiceType(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">— Select service type —</option>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
                <textarea
                  rows={4}
                  placeholder="Add job notes…"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>

              <div className="h-2" />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background flex flex-col gap-2">
              <button
                onClick={saveJobEdits}
                disabled={editSaving}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-extrabold text-sm hover:bg-primary/90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={() => setEditModalOpen(false)}
                className="w-full py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── SET RECURRING SCHEDULE BOTTOM SHEET ── */}
      {recurringSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setRecurringSheetOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden" ref={swipeRecurring.sheetRef} {...swipeRecurring.sheetDragProps}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <span className="material-symbols-outlined text-[28px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    autorenew
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground leading-tight">Set Recurring Schedule</h2>
                  <p className="text-sm text-muted-foreground">How often should this job repeat?</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

              {/* Frequency picker */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedFrequency(opt.value)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                        selectedFrequency === opt.value
                          ? "bg-primary text-white shadow-md shadow-primary/20"
                          : "bg-muted/50 text-foreground border border-border hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom interval input */}
              {selectedFrequency === "custom" && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Repeat every
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      className="w-24 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <span className="text-sm font-medium text-muted-foreground">days</span>
                  </div>
                </div>
              )}

              <div className="h-2" />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background flex flex-col gap-2">
              <button
                onClick={saveRecurrence}
                disabled={recurringSaving || !selectedFrequency}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-extrabold text-sm hover:bg-primary/90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {recurringSaving ? "Saving…" : "Confirm"}
              </button>
              <button
                onClick={() => setRecurringSheetOpen(false)}
                className="w-full py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── ASSIGN EMPLOYEES MODAL ── */}
      {assignModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => { setAssignModalOpen(false); setEmployeeSearch(""); }}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden" ref={swipeAssign.sheetRef} {...swipeAssign.sheetDragProps}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <span className="material-symbols-outlined text-[28px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    group
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground leading-tight">Assign Employees</h2>
                  <p className="text-sm text-muted-foreground">Select crew for this job</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

              {/* Duration inputs */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job Duration</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={durationHours}
                      onChange={(e) => {
                        const h = Math.max(0, parseInt(e.target.value) || 0);
                        setDurationHours(h);
                        handleDurationInputChange(h, durationMinutes);
                      }}
                      className="w-20 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <span className="text-sm font-medium text-muted-foreground">hrs</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={durationMinutes}
                      onChange={(e) => {
                        const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                        setDurationMinutes(m);
                        handleDurationInputChange(durationHours, m);
                      }}
                      className="w-20 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <span className="text-sm font-medium text-muted-foreground">min</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Availability context */}
              {!editDurationMins ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground shrink-0">timer</span>
                  <p className="text-xs text-muted-foreground font-medium">Enter a duration above to check availability</p>
                </div>
              ) : (
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Availability · {formatScheduled(job.scheduled_at)}
                </p>
              )}

              {/* Search */}
              {teamMembers.length > 0 && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-muted-foreground pointer-events-none">search</span>
                  <input
                    type="text"
                    placeholder="Search employees…"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  {employeeSearch && (
                    <button
                      onClick={() => setEmployeeSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
              )}

              {/* Team member list */}
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active team members found</p>
              ) : (() => {
                const filtered = teamMembers.filter((m) =>
                  m.name.toLowerCase().includes(employeeSearch.toLowerCase())
                );
                if (filtered.length === 0) {
                  return <p className="text-sm text-muted-foreground text-center py-4">No employees match "{employeeSearch}"</p>;
                }
                return (
                  <div className="flex flex-col gap-2">
                    {filtered.map((m) => {
                      const isSelected = assignedIds.includes(m.id);
                      const status = memberAvailability[m.id] ?? "unknown";
                      const statusConfig = {
                        available: { color: "text-[var(--color-status-completed)]", dot: "bg-[var(--color-status-completed)]", label: "Available" },
                        busy: { color: "text-[var(--color-status-in-progress)]", dot: "bg-[var(--color-status-in-progress)]", label: "Busy" },
                        off: { color: "text-muted-foreground", dot: "bg-muted-foreground/40", label: "Off" },
                        unknown: { color: "", dot: "", label: "" },
                      }[status];
                      return (
                        <button
                          key={m.id}
                          onClick={() =>
                            setAssignedIds((prev) =>
                              prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                            )
                          }
                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all active:scale-[0.98] ${
                            isSelected
                              ? "bg-primary/10 border-primary/30"
                              : "bg-card border-border hover:bg-muted/30"
                          }`}
                        >
                          <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${isSelected ? "bg-primary text-white" : "bg-muted text-foreground"}`}>
                            {isSelected
                              ? <span className="material-symbols-outlined text-[18px]">check</span>
                              : m.name.charAt(0).toUpperCase()
                            }
                          </div>
                          <span className="text-sm font-bold text-foreground flex-1 text-left">{m.name}</span>
                          {status !== "unknown" && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className={`size-2 rounded-full ${statusConfig.dot}`} />
                              <span className={`text-xs font-bold ${statusConfig.color}`}>{statusConfig.label}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="h-2" />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background flex flex-col gap-2">
              <button
                onClick={saveAssignment}
                disabled={assignSaving}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-extrabold text-sm hover:bg-primary/90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {assignSaving ? "Saving…" : `Save${assignedIds.length > 0 ? ` (${assignedIds.length} employee${assignedIds.length > 1 ? "s" : ""})` : ""}`}
              </button>
              <button
                onClick={() => { setAssignModalOpen(false); setEmployeeSearch(""); }}
                className="w-full py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── COLLECT PAYMENT MODAL ── */}
      {payModalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden" ref={swipePay.sheetRef} {...swipePay.sheetDragProps}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Auto-scheduled toast */}
            {autoScheduledDate && (
              <div className="mx-5 mt-2 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 shrink-0">
                <span className="material-symbols-outlined text-[20px] text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                  autorenew
                </span>
                <p className="text-sm font-bold text-primary">
                  Next job auto-scheduled for {formatDateShort(autoScheduledDate)}
                </p>
              </div>
            )}

            {/* Success header */}
            <div className="px-5 pt-3 pb-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-status-completed/10">
                  <span className="material-symbols-outlined text-[28px] text-[var(--color-status-completed)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    task_alt
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground leading-tight">Job Complete!</h2>
                  <p className="text-sm text-muted-foreground">
                    {job.clients?.name ?? "Client"} · {formatCurrency(job.total, currency)} due
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

              {/* Amount */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount Collected</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full rounded-xl border border-border bg-card pl-8 pr-4 py-3 text-sm text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
              </div>

              {/* Payment method */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setPayMethod(m.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        payMethod === m.value
                          ? "bg-[var(--color-status-completed)] text-white shadow-sm"
                          : "bg-muted/50 text-foreground border border-border hover:bg-muted"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {m.icon}
                      </span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in full, check #1234…"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div className="h-2" />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background flex flex-col gap-2">
              <button
                onClick={collectPayment}
                disabled={paySaving}
                className="w-full py-3.5 rounded-2xl bg-[var(--color-status-completed)] text-white font-extrabold text-sm hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-md flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">attach_money</span>
                {paySaving ? "Recording…" : `Record ${formatCurrency(parseFloat(payAmount || "0"), currency)} Payment`}
              </button>
              <button
                onClick={() => { setPayModalOpen(false); router.push("/jobs"); }}
                className="w-full py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip — collect later
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
