"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "custom" | null;

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

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  recurrence_frequency: RecurrenceFrequency;
  recurrence_interval_days: number | null;
  business_id: string | null;
  client_id: string | null;
  quote_id: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
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
  in_progress: { label: "In Progress", className: "bg-[#ea580c]/10 text-[#ea580c] border-0" },
  completed: { label: "Completed", className: "bg-[#16a34a]/10 text-[#16a34a] border-0" },
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

      setBusinessId(bizId);

      const [{ data, error }, { data: expData }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, completed_at, notes, recurrence_frequency, recurrence_interval_days, business_id, client_id, quote_id, before_photo_url, after_photo_url, clients(name, phone, email, address), job_line_items(id, description, quantity, unit_price)")
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
        setJob(data as unknown as Job);
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
    setEditModalOpen(true);
  }

  async function saveJobEdits() {
    if (!job) return;
    setEditSaving(true);
    const supabase = createClient();
    const updates: { scheduled_at?: string | null; notes?: string | null } = {
      notes: editNotes || null,
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
    await fetch("/api/email/send-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    });
    setEmailSending(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  }

  function sendInvoice() {
    if (!job?.clients?.phone) return;
    const body = `Hi ${job.clients.name}! Your invoice for $${job.total.toFixed(2)} is ready. Reply to confirm or call to pay. - HustleBricks`;
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
        <button onClick={() => router.push("/jobs")} className="text-sm text-[#007AFF] font-bold">← Back to Jobs</button>
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

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-36">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.push("/jobs")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
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
                  className="flex size-8 items-center justify-center rounded-full bg-[#16a34a]/10 text-[#16a34a] hover:bg-[#16a34a]/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                </a>
              )}
              {job.clients?.phone && (
                <button
                  onClick={sendInvoice}
                  className={`flex size-8 items-center justify-center rounded-full transition-colors ${invoiceSent ? "bg-[#16a34a]/10 text-[#16a34a]" : "bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/20"}`}
                  title={invoiceSent ? "Invoice opened!" : "Send invoice via SMS"}
                >
                  <span className="material-symbols-outlined text-[16px]">{invoiceSent ? "check" : "sms"}</span>
                </button>
              )}
              {job.clients?.email && (
                <button
                  onClick={sendInvoiceEmail}
                  disabled={emailSending}
                  className={`flex size-8 items-center justify-center rounded-full transition-colors ${emailSent ? "bg-[#16a34a]/10 text-[#16a34a]" : "bg-[#ea580c]/10 text-[#ea580c] hover:bg-[#ea580c]/20"} disabled:opacity-50`}
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
                className="flex size-8 items-center justify-center rounded-full bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/20 transition-colors"
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
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Scheduled</span>
              <span className="text-sm font-bold text-foreground">{formatScheduled(job.scheduled_at)}</span>
            </div>
          </div>

        </div>

        {/* Notes */}
        {job.notes && (
          <div className="bg-[#ea580c]/5 p-4 border-t border-[#ea580c]/10 flex gap-3">
            <span className="material-symbols-outlined text-[#ea580c] text-[20px] shrink-0 mt-0.5">sticky_note_2</span>
            <p className="text-sm text-[#ea580c] font-medium leading-relaxed">{job.notes}</p>
          </div>
        )}
      </Card>

      {/* Line items */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Line Items</h3>
          <span className="font-extrabold text-foreground">${job.total.toFixed(2)}</span>
        </div>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          {job.job_line_items.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <Separator className="bg-border/50 mx-4" />}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] text-[#16a34a]">check_circle</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{item.description}</span>
                    {item.quantity > 1 && (
                      <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                    )}
                  </div>
                </div>
                <span className="font-bold text-sm text-foreground">
                  ${(item.unit_price * item.quantity).toFixed(2)}
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
            className="text-xs font-bold text-[#007AFF] flex items-center gap-1 hover:opacity-80 transition-opacity"
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
                <span className="text-base font-extrabold text-foreground">${job.total.toFixed(2)}</span>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expenses</span>
                <span className="text-base font-extrabold text-[#ea580c]">${totalExpenses.toFixed(2)}</span>
              </div>
              <div className={`rounded-2xl border p-3 flex flex-col gap-0.5 ${profit >= 0 ? "border-[#16a34a]/30 bg-[#16a34a]/5" : "border-[#dc2626]/30 bg-[#dc2626]/5"}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Profit</span>
                <span className={`text-base font-extrabold ${profit >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                  ${profit.toFixed(2)}
                </span>
                <span className="text-[9px] font-bold text-muted-foreground">{margin.toFixed(0)}% margin</span>
              </div>
            </div>
          );
        })()}

        {/* Add expense form */}
        {showAddExpense && (
          <div className="rounded-2xl border border-[#007AFF]/30 bg-[#007AFF]/5 p-4 mb-3 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                className="flex-1 text-sm rounded-xl border border-border bg-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
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
                  className="w-24 text-sm rounded-xl border border-border bg-background pl-6 pr-2 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setExpenseForm((f) => ({ ...f, category: cat.value }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${expenseForm.category === cat.value ? "bg-[#007AFF] text-white" : "bg-muted text-foreground border border-border hover:bg-muted/80"}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <button
              onClick={addExpense}
              disabled={expenseSaving || !expenseForm.description || !expenseForm.amount}
              className="w-full py-2.5 rounded-xl bg-[#007AFF] text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
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
                    <span className="text-sm font-bold text-[#ea580c]">${Number(exp.amount).toFixed(2)}</span>
                    <button
                      onClick={() => deleteExpense(exp.id)}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-[#dc2626] hover:bg-[#dc2626]/10 transition-colors"
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
            className="w-full py-6 rounded-2xl border border-dashed border-border text-muted-foreground text-sm flex items-center justify-center gap-2 hover:border-[#007AFF]/40 hover:text-[#007AFF] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Log an expense
          </button>
        )}
      </section>

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
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>autorenew</span>
                </div>
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Recurring job</span>
                    <Badge variant="secondary" className="bg-[#007AFF]/10 text-[#007AFF] border-0 text-[10px] uppercase font-bold tracking-wider">
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
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-[#007AFF] text-white hover:bg-[#007AFF]/90 active:scale-95 transition-all"
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
                className="relative flex flex-col rounded-2xl overflow-hidden border border-dashed border-border bg-card/50 items-center justify-center min-h-[140px] transition-colors hover:border-[#007AFF]/50 hover:bg-muted/30 disabled:opacity-60 active:scale-[0.98]"
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

      {/* Completed — show collect payment prompt if no modal */}
      {job.status === "completed" && !payModalOpen && (
        <div className="fixed bottom-0 left-0 w-full z-40 bg-card border-t border-border p-4 pb-10">
          <div className="max-w-xl mx-auto flex gap-3">
            <button
              onClick={() => setPayModalOpen(true)}
              className="flex-[2] rounded-xl font-bold py-4 text-sm bg-[#16a34a] text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
        <div className="fixed bottom-0 left-0 w-full z-40 bg-card border-t border-border p-4 pb-10">
          <div className="max-w-xl mx-auto flex gap-3">
            {job.status === "scheduled" && (
              <button
                onClick={() => updateStatus("in_progress")}
                disabled={updating}
                className="flex-[2] rounded-xl font-bold py-4 text-sm bg-[#ea580c] text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="flex-[2] rounded-xl font-bold py-4 text-sm bg-[#16a34a] text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#007AFF]/10">
                  <span className="material-symbols-outlined text-[28px] text-[#007AFF]" style={{ fontVariationSettings: "'FILL' 1" }}>
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
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
                <textarea
                  rows={4}
                  placeholder="Add job notes…"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 resize-none"
                />
              </div>

              <div className="h-2" />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background flex flex-col gap-2">
              <button
                onClick={saveJobEdits}
                disabled={editSaving}
                className="w-full py-3.5 rounded-2xl bg-[#007AFF] text-white font-extrabold text-sm hover:bg-[#007AFF]/90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-[#007AFF]/20 flex items-center justify-center gap-2"
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
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#007AFF]/10">
                  <span className="material-symbols-outlined text-[28px] text-[#007AFF]" style={{ fontVariationSettings: "'FILL' 1" }}>
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
                          ? "bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/20"
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
                      className="w-24 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
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
                className="w-full py-3.5 rounded-2xl bg-[#007AFF] text-white font-extrabold text-sm hover:bg-[#007AFF]/90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-[#007AFF]/20 flex items-center justify-center gap-2"
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

      {/* ── COLLECT PAYMENT MODAL ── */}
      {payModalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Auto-scheduled toast */}
            {autoScheduledDate && (
              <div className="mx-5 mt-2 px-4 py-3 rounded-2xl bg-[#007AFF]/10 border border-[#007AFF]/20 flex items-center gap-3 shrink-0">
                <span className="material-symbols-outlined text-[20px] text-[#007AFF] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                  autorenew
                </span>
                <p className="text-sm font-bold text-[#007AFF]">
                  Next job auto-scheduled for {formatDateShort(autoScheduledDate)}
                </p>
              </div>
            )}

            {/* Success header */}
            <div className="px-5 pt-3 pb-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#16a34a]/10">
                  <span className="material-symbols-outlined text-[28px] text-[#16a34a]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    task_alt
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground leading-tight">Job Complete!</h2>
                  <p className="text-sm text-muted-foreground">
                    {job.clients?.name ?? "Client"} · ${job.total.toFixed(2)} due
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
                    className="w-full rounded-xl border border-border bg-card pl-8 pr-4 py-3 text-sm text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30"
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
                          ? "bg-[#16a34a] text-white shadow-sm"
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
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                />
              </div>

              <div className="h-2" />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background flex flex-col gap-2">
              <button
                onClick={collectPayment}
                disabled={paySaving}
                className="w-full py-3.5 rounded-2xl bg-[#16a34a] text-white font-extrabold text-sm hover:bg-[#16a34a]/90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-[#16a34a]/20 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">attach_money</span>
                {paySaving ? "Recording…" : `Record $${parseFloat(payAmount || "0").toFixed(2)} Payment`}
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
