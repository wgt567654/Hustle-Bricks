"use client";

import { use, useEffect, useRef, useState } from "react";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { STATUS_HEX } from "@/lib/status-colors";
import { formatCurrency, formatCurrencyRounded } from "@/lib/currency";

type Tag = "residential" | "commercial" | "vip";
type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
type RecurringPlan = "none" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";

type ClientDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tag: Tag;
  notes: string | null;
  recurring_plan: RecurringPlan;
  created_at: string;
};

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  completed_at: string | null;
  job_line_items: { description: string }[];
  payments: { status: string }[];
};

type BookingRequest = {
  id: string;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

const TAG_LABELS: Record<Tag, string> = {
  residential: "Residential",
  commercial: "Commercial",
  vip: "VIP",
};

const TAG_COLORS: Record<Tag, { bg: string; text: string; border: string }> = {
  residential: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  commercial: { bg: "bg-foreground/10", text: "text-foreground", border: "border-foreground/10" },
  vip: { bg: "icon-orange", text: "", border: "border-[var(--color-status-in-progress)]/20" },
};

const STATUS_COLORS = STATUS_HEX;

const STATUS_LABELS: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PLAN_LABELS: Record<RecurringPlan, string> = {
  none: "No Plan",
  weekly: "Weekly",
  biweekly: "Bi-Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annual",
};

const PLAN_OPTIONS: RecurringPlan[] = ["none", "weekly", "biweekly", "monthly", "quarterly", "annually"];

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", tag: "residential" as Tag, notes: "", recurring_plan: "none" as RecurringPlan });
  const [saving, setSaving] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [actioningRequest, setActioningRequest] = useState<string | null>(null);

  // Stripe recurring billing
  type BillingSub = {
    id: string;
    stripe_subscription_id: string;
    status: string;
    amount: number;
    currency: string;
    interval: string;
    interval_count: number;
    description: string | null;
    next_billing_date: string | null;
  };
  const [connectStatus, setConnectStatus] = useState<string>("not_connected");
  const [activeBillingSub, setActiveBillingSub] = useState<BillingSub | null>(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingForm, setBillingForm] = useState({ amount: "", interval: "month", description: "" });
  const [submittingBilling, setSubmittingBilling] = useState(false);
  const [cancelingBilling, setCancelingBilling] = useState(false);

  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  async function sendByEmail() {
    setEmailSending(true);
    await fetch("/api/email/send-booking-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    });
    setEmailSending(false);
    setEmailSent(true);
    setTimeout(() => { setEmailSent(false); setSendMenuOpen(false); }, 2000);
  }

  function sendBySms() {
    if (!client) return;
    const url = `${window.location.origin}/portal/${id}`;
    const msg = encodeURIComponent(`Hi ${client.name}! Use this link to book your appointment: ${url}`);
    window.open(`sms:${client.phone}?body=${msg}`);
    setSendMenuOpen(false);
  }

  function copyLink() {
    const url = `${window.location.origin}/portal/${id}`;
    if (navigator.share) {
      navigator.share({ title: "Book your appointment", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: clientData, error } = await supabase
        .from("clients")
        .select("id, name, email, phone, address, tag, notes, recurring_plan, created_at")
        .eq("id", id)
        .single();

      if (error || !clientData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const c = clientData as ClientDetail;
      setClient(c);
      setNotesValue(c.notes ?? "");
      setForm({
        name: c.name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        address: c.address ?? "",
        tag: c.tag as Tag,
        notes: c.notes ?? "",
        recurring_plan: (c.recurring_plan as RecurringPlan) ?? "none",
      });

      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, status, total, scheduled_at, completed_at, job_line_items(description), payments(status)")
        .eq("client_id", id)
        .order("scheduled_at", { ascending: false });

      setJobs((jobsData as unknown as Job[]) ?? []);

      // Load pending booking requests
      const { data: biz } = await supabase
        .from("businesses")
        .select("id, currency, stripe_connect_status")
        .eq("owner_id", (await supabase.auth.getUser()).data.user!.id)
        .single();
      if (biz?.currency) setCurrency(biz.currency);
      if (biz) {
        setBusinessId(biz.id);
        setConnectStatus((biz as unknown as { stripe_connect_status: string | null }).stripe_connect_status ?? "not_connected");

        const { data: reqs } = await supabase
          .from("booking_requests")
          .select("id, requested_date, requested_time, notes, status, created_at")
          .eq("client_id", id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        setBookingRequests((reqs as BookingRequest[]) ?? []);

        // Load active billing subscription
        const { data: billingSubs } = await supabase
          .from("client_billing_subscriptions")
          .select("id, stripe_subscription_id, status, amount, currency, interval, interval_count, description, next_billing_date")
          .eq("business_id", biz.id)
          .eq("client_id", id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        if (billingSubs && billingSubs.length > 0) {
          setActiveBillingSub(billingSubs[0] as BillingSub);
        }
      }

      setLoading(false);
    }
    load();
  }, [id]);

  async function saveEdit() {
    if (!client) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("clients").update({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      tag: form.tag,
      notes: form.notes.trim() || null,
      recurring_plan: form.recurring_plan,
    }).eq("id", client.id);

    setClient((c) => c ? {
      ...c,
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
      recurring_plan: form.recurring_plan,
    } : c);
    setNotesValue(form.notes.trim());
    setSaving(false);
    setEditOpen(false);
  }

  async function saveNotes() {
    if (!client) return;
    setSavingNotes(true);
    const supabase = createClient();
    await supabase.from("clients").update({ notes: notesValue.trim() || null }).eq("id", client.id);
    setClient((c) => c ? { ...c, notes: notesValue.trim() || null } : c);
    setSavingNotes(false);
    setEditingNotes(false);
  }

  async function approveBooking(req: BookingRequest) {
    if (!businessId || !client) return;
    setActioningRequest(req.id);
    const supabase = createClient();
    const scheduledAt = new Date(`${req.requested_date}T${req.requested_time}:00`).toISOString();
    await Promise.all([
      supabase.from("jobs").insert({
        business_id: businessId,
        client_id: client.id,
        status: "scheduled",
        scheduled_at: scheduledAt,
        total: 0,
        notes: req.notes || null,
      }),
      supabase.from("booking_requests").update({ status: "accepted" }).eq("id", req.id),
    ]);
    setBookingRequests((prev) => prev.filter((r) => r.id !== req.id));
    setActioningRequest(null);
    // Reload jobs to show the new one
    const { data: jobsData } = await supabase
      .from("jobs")
      .select("id, status, total, scheduled_at, completed_at, job_line_items(description), payments(status)")
      .eq("client_id", id)
      .order("scheduled_at", { ascending: false });
    setJobs((jobsData as unknown as Job[]) ?? []);
  }

  async function declineBooking(reqId: string) {
    setActioningRequest(reqId);
    const supabase = createClient();
    await supabase.from("booking_requests").update({ status: "declined" }).eq("id", reqId);
    setBookingRequests((prev) => prev.filter((r) => r.id !== reqId));
    setActioningRequest(null);
  }

  function startEditingNotes() {
    setEditingNotes(true);
    setTimeout(() => notesRef.current?.focus(), 50);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading client…</p>
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="font-bold text-foreground">Client not found</p>
        <button onClick={() => router.push("/clients")} className="text-sm text-primary font-bold">← Back to Clients</button>
      </div>
    );
  }

  const upcomingJobs = jobs.filter((j) => j.status === "scheduled" || j.status === "in_progress");
  const pastJobs = jobs.filter((j) => j.status === "completed" || j.status === "cancelled");
  const lifetimeRevenue = pastJobs.filter((j) => j.status === "completed").reduce((s, j) => {
    const paid = j.payments?.some((p) => p.status === "paid");
    return paid ? s + j.total : s;
  }, 0);
  const outstanding = pastJobs.filter((j) => j.status === "completed").reduce((s, j) => {
    const paid = j.payments?.some((p) => p.status === "paid");
    return !paid ? s + j.total : s;
  }, 0);

  async function setupAutoBilling() {
    if (!businessId) return;
    const amount = parseFloat(billingForm.amount);
    if (!amount || amount <= 0) return;
    setSubmittingBilling(true);
    try {
      const res = await fetch("/api/stripe/connect/client-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          clientId: id,
          amount,
          interval: billingForm.interval,
          intervalCount: 1,
          description: billingForm.description || undefined,
        }),
      });
      const { ok, subscription, error } = await res.json();
      if (ok && subscription) {
        setActiveBillingSub(subscription as BillingSub);
        setShowBillingModal(false);
        setBillingForm({ amount: "", interval: "month", description: "" });
      } else {
        alert(error ?? "Could not create subscription");
      }
    } finally {
      setSubmittingBilling(false);
    }
  }

  async function cancelAutoBilling() {
    if (!activeBillingSub) return;
    setCancelingBilling(true);
    try {
      const res = await fetch(`/api/stripe/connect/client-subscription/${activeBillingSub.stripe_subscription_id}`, {
        method: "DELETE",
      });
      const { ok } = await res.json();
      if (ok) setActiveBillingSub(null);
    } finally {
      setCancelingBilling(false);
    }
  }

  const tagStyle = TAG_COLORS[client.tag];
  const hasPlan = client.recurring_plan && client.recurring_plan !== "none";

  const swipeSendMenu = useSwipeToDismiss(() => setSendMenuOpen(false));
  const swipeEdit = useSwipeToDismiss(() => setEditOpen(false));

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-28 lg:pb-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/clients")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</p>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-tight truncate">{client.name}</h1>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="flex size-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </button>
      </div>

      {/* Two-column body on desktop */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">

      {/* ── Left column: profile + stats + notes ── */}
      <div className="flex flex-col gap-6 lg:flex-[3]">

      {/* Profile card */}
      <Card className="rounded-3xl border-border shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col gap-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className={`flex size-16 shrink-0 items-center justify-center rounded-2xl font-extrabold text-xl border ${tagStyle.bg} ${tagStyle.text} ${tagStyle.border}`}>
              {getInitials(client.name)}
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-extrabold text-foreground leading-tight">{client.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={`border-0 text-[10px] font-bold uppercase tracking-wide ${tagStyle.bg} ${tagStyle.text}`}>
                  {TAG_LABELS[client.tag]}
                </Badge>
                {hasPlan && (
                  <Badge variant="secondary" className="border-0 text-[10px] font-bold uppercase tracking-wide icon-violet">
                    <span className="material-symbols-outlined text-[10px] mr-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>autorenew</span>
                    {PLAN_LABELS[client.recurring_plan]}
                  </Badge>
                )}
                {client.tag === "vip" && (
                  <span className="material-symbols-outlined text-[var(--color-status-in-progress)] text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Client since {formatDate(client.created_at)}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl icon-green  font-bold text-sm hover:opacity-90 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                Call
              </a>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                Email
              </a>
            )}
            <button
              onClick={() => setSendMenuOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 font-bold text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              Send Link
            </button>
            <button
              onClick={() => router.push(`/quotes/new?client=${client.id}`)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">request_quote</span>
              Quote
            </button>
          </div>

          {/* Contact info */}
          {(client.phone || client.email || client.address) && (
            <>
              <Separator className="bg-border/50" />
              <div className="flex flex-col gap-3">
                {client.phone && (
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-muted-foreground">call</span>
                    <span className="text-sm text-foreground font-medium">{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-muted-foreground">mail</span>
                    <span className="text-sm text-foreground font-medium">{client.email}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[18px] text-muted-foreground mt-0.5">location_on</span>
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span className="text-sm text-foreground font-medium leading-snug">{client.address}</span>
                      <a
                        href={`https://maps.apple.com/?q=${encodeURIComponent(client.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">navigation</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Revenue summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</span>
          <span className="text-xl font-extrabold text-[var(--color-status-completed)] tracking-tight">
            {formatCurrencyRounded(lifetimeRevenue, currency)}
          </span>
          <span className="text-[10px] text-muted-foreground">lifetime</span>
        </Card>
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding</span>
          <span className={`text-xl font-extrabold tracking-tight ${outstanding > 0 ? "text-[var(--color-status-in-progress)]" : "text-[var(--color-status-completed)]"}`}>
            {outstanding > 0 ? formatCurrencyRounded(outstanding, currency) : "✓"}
          </span>
          <span className="text-[10px] text-muted-foreground">unpaid</span>
        </Card>
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jobs</span>
          <span className="text-xl font-extrabold text-foreground tracking-tight">{jobs.length}</span>
          <span className="text-[10px] text-muted-foreground">{upcomingJobs.length} upcoming</span>
        </Card>
      </div>

      {/* Property Notes */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--color-status-in-progress)]" style={{ fontVariationSettings: "'FILL' 1" }}>sticky_note_2</span>
            <p className="text-sm font-bold text-foreground">Property Notes</p>
          </div>
          {!editingNotes && (
            <button
              onClick={startEditingNotes}
              className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
            </button>
          )}
        </div>
        <div className="p-4">
          {editingNotes ? (
            <div className="flex flex-col gap-3">
              <textarea
                ref={notesRef}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                placeholder="Gate code, dog in yard, parking notes, glass type preferences…"
                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingNotes(false); setNotesValue(client.notes ?? ""); }}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {savingNotes ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : client.notes ? (
            <p
              className="text-sm text-foreground leading-relaxed cursor-text"
              onClick={startEditingNotes}
            >
              {client.notes}
            </p>
          ) : (
            <button
              onClick={startEditingNotes}
              className="w-full flex flex-col items-center gap-1.5 py-5 text-center rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-colors"
            >
              <span className="material-symbols-outlined text-[28px] text-muted-foreground/40">add_notes</span>
              <p className="text-xs font-medium text-muted-foreground">Add property notes</p>
              <p className="text-[11px] text-muted-foreground/60">Gate codes, pets, parking, preferences…</p>
            </button>
          )}
        </div>
      </Card>

      </div>{/* end left column */}

      {/* ── Right column: auto-billing + booking requests + job history ── */}
      <div className="flex flex-col gap-6 lg:flex-[2]">

      {/* Auto-Billing */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Auto-Billing</h3>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          {activeBillingSub ? (
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="size-10 shrink-0 rounded-full bg-[#635bff]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-[#635bff]">autorenew</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-foreground">
                    {formatCurrency(activeBillingSub.amount, activeBillingSub.currency.toUpperCase())} / {activeBillingSub.interval}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {activeBillingSub.description ?? "Recurring billing"}
                    {activeBillingSub.next_billing_date
                      ? ` · Next: ${new Date(activeBillingSub.next_billing_date).toLocaleDateString([], { month: "short", day: "numeric" })}`
                      : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">Active</span>
                <button
                  onClick={cancelAutoBilling}
                  disabled={cancelingBilling}
                  className="text-xs font-bold text-destructive hover:opacity-80 disabled:opacity-50"
                >
                  {cancelingBilling ? "…" : "Cancel"}
                </button>
              </div>
            </div>
          ) : connectStatus === "active" ? (
            <button
              onClick={() => setShowBillingModal(true)}
              className="w-full flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-[#635bff]/10 group-hover:text-[#635bff] transition-colors">
                <span className="material-symbols-outlined text-[20px]">add</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold text-sm text-foreground">Set Up Auto-Billing</span>
                <span className="text-xs text-muted-foreground">Stripe sends the client a recurring invoice</span>
              </div>
            </button>
          ) : (
            <div className="p-4 flex items-center gap-3 opacity-60">
              <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-muted-foreground">credit_card_off</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground">Auto-Billing Unavailable</span>
                <a href="/settings" className="text-xs text-primary hover:underline">Connect Stripe in Settings to enable →</a>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Auto-Billing Modal */}
      {showBillingModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowBillingModal(false)}>
          <div className="w-full max-w-sm bg-card rounded-3xl shadow-xl p-6 flex flex-col gap-5 mx-4 mb-4 sm:mb-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-lg text-foreground">Set Up Auto-Billing</h2>
              <button onClick={() => setShowBillingModal(false)} className="text-muted-foreground hover:text-foreground">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Amount per cycle</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={billingForm.amount}
                    onChange={(e) => setBillingForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-muted/30 pl-7 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["week", "month", "year"] as const).map((iv) => (
                    <button
                      key={iv}
                      onClick={() => setBillingForm((f) => ({ ...f, interval: iv }))}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        billingForm.interval === iv
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-foreground"
                      }`}
                    >
                      {iv === "week" ? "Weekly" : iv === "month" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly lawn care"
                  value={billingForm.description}
                  onChange={(e) => setBillingForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Stripe will email {client.name} a recurring invoice. They pay via a Stripe-hosted link.
            </p>
            <button
              onClick={setupAutoBilling}
              disabled={submittingBilling || !billingForm.amount}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submittingBilling ? "Creating…" : "Start Auto-Billing"}
            </button>
          </div>
        </div>
      )}

      {/* Booking Requests */}
      {bookingRequests.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Booking Requests</h3>
            <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">{bookingRequests.length} pending</span>
          </div>
          {bookingRequests.map((req) => {
            const dateLabel = new Date(req.requested_date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            });
            const [h] = req.requested_time.split(":").map(Number);
            const timeLabel = `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
            const isActioning = actioningRequest === req.id;
            return (
              <Card key={req.id} className="rounded-2xl border-amber-200 shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-amber-400" />
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-extrabold text-sm text-foreground">{dateLabel} · {timeLabel}</p>
                      {req.notes && <p className="text-xs text-muted-foreground line-clamp-2">{req.notes}</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold shrink-0">
                      Pending
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => declineBooking(req.id)}
                      disabled={isActioning}
                      className="flex-1 py-2 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => approveBooking(req)}
                      disabled={isActioning}
                      className="flex-[2] py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {isActioning ? "Creating job…" : "Approve & Schedule"}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {/* Upcoming jobs */}
      {upcomingJobs.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Upcoming</h3>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs font-bold">{upcomingJobs.length}</Badge>
          </div>
          {upcomingJobs.map((job) => <JobCard key={job.id} job={job} onClick={() => router.push(`/jobs/${job.id}`)} currency={currency} />)}
        </section>
      )}

      {/* Job history */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">History</h3>
          {pastJobs.length > 0 && (
            <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-xs">{pastJobs.length}</Badge>
          )}
        </div>

        {jobs.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center bg-card rounded-2xl border border-border/50">
            <span className="material-symbols-outlined text-[40px] text-muted-foreground/30">home_repair_service</span>
            <p className="text-sm text-muted-foreground">No jobs yet</p>
            <button
              onClick={() => router.push(`/quotes/new?client=${client.id}`)}
              className="mt-1 text-sm font-bold text-primary hover:underline"
            >
              Create a quote →
            </button>
          </div>
        )}

        {pastJobs.length === 0 && jobs.length > 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No completed jobs yet</p>
        )}

        {pastJobs.map((job) => <JobCard key={job.id} job={job} onClick={() => router.push(`/jobs/${job.id}`)} currency={currency} />)}
      </section>

      </div>{/* end right column */}
      </div>{/* end two-column body */}

      {/* New quote FAB */}
      <button
        onClick={() => router.push(`/quotes/new?client=${client.id}`)}
        className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-primary/40 shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">request_quote</span>
      </button>

      {/* Send Booking Link bottom sheet */}
      {sendMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSendMenuOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden" style={swipeSendMenu.sheetStyle}>
            {/* Drag zone: handle + header */}
            <div {...swipeSendMenu.dragHandleProps}>
            <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-base font-extrabold text-foreground">Send Booking Link</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Choose how to send {client?.name} their scheduling link</p>
            </div>
            </div>{/* end drag zone */}
            <div className="flex flex-col divide-y divide-border/40 px-2 py-2">
              {client?.email && (
                <button
                  onClick={sendByEmail}
                  disabled={emailSending || emailSent}
                  className="flex items-center gap-4 px-3 py-4 rounded-2xl hover:bg-muted/40 transition-colors text-left disabled:opacity-70"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="material-symbols-outlined text-[22px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-bold text-sm text-foreground">
                      {emailSent ? "Email sent!" : emailSending ? "Sending…" : "Send Email"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{client.email}</span>
                  </div>
                  {emailSent && <span className="material-symbols-outlined text-[var(--color-status-completed)] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                </button>
              )}
              {client?.phone && (
                <button
                  onClick={sendBySms}
                  className="flex items-center gap-4 px-3 py-4 rounded-2xl hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                    <span className="material-symbols-outlined text-[22px] text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-bold text-sm text-foreground">Send Text</span>
                    <span className="text-xs text-muted-foreground">{client.phone}</span>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground/40 text-[18px]">open_in_new</span>
                </button>
              )}
              <button
                onClick={copyLink}
                className="flex items-center gap-4 px-3 py-4 rounded-2xl hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
                  <span className="material-symbols-outlined text-[22px] text-muted-foreground" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {linkCopied ? "check_circle" : "link"}
                  </span>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-bold text-sm text-foreground">{linkCopied ? "Copied!" : "Copy Link"}</span>
                  <span className="text-xs text-muted-foreground">Share the portal URL any way you like</span>
                </div>
              </button>
            </div>
            <div className="px-5 py-4 border-t border-border/50">
              <button
                onClick={() => setSendMenuOpen(false)}
                className="w-full py-3 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit modal */}
      {editOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden" style={swipeEdit.sheetStyle}>
            {/* Drag zone: handle + header */}
            <div {...swipeEdit.dragHandleProps} className="shrink-0">
            <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <h2 className="text-lg font-extrabold text-foreground">Edit Client</h2>
              <button onClick={() => setEditOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            </div>{/* end drag zone */}

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client Type</label>
                <div className="flex gap-2">
                  {(["residential", "commercial", "vip"] as Tag[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, tag: t }))}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-95 ${
                        form.tag === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-foreground"
                      }`}
                    >
                      {TAG_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Maintenance Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLAN_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setForm((f) => ({ ...f, recurring_plan: p }))}
                      className={`rounded-xl border py-2.5 text-xs font-bold transition-all active:scale-95 ${
                        form.recurring_plan === p
                          ? "border-highlight-violet icon-violet"
                          : "border-border bg-muted/40 text-foreground"
                      }`}
                    >
                      {PLAN_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none" />
              </div>
              <div className="h-2" />
            </div>

            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background">
              <button
                onClick={saveEdit}
                disabled={saving || !form.name.trim()}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-extrabold text-sm hover:bg-primary/90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function JobCard({ job, onClick, currency }: { job: Job; onClick: () => void; currency: string }) {
  const title = job.job_line_items[0]?.description ?? "Job";
  const color = STATUS_COLORS[job.status];
  const isPaid = job.payments?.some((p) => p.status === "paid");
  const date = job.completed_at ?? job.scheduled_at;

  return (
    <Card
      onClick={onClick}
      className="overflow-hidden rounded-2xl border-border shadow-sm cursor-pointer hover:shadow-md hover:border-primary/20 transition-all"
    >
      <div className="h-1 w-full" style={{ backgroundColor: color }} />
      <div className="p-4 flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: color }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            home_repair_service
          </span>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-bold text-foreground text-sm leading-tight truncate">{title}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className="border-0 text-[9px] font-bold uppercase px-1.5 py-0" style={{ backgroundColor: `${color}18`, color }}>
              {STATUS_LABELS[job.status]}
            </Badge>
            {date && <span className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-extrabold text-sm text-foreground">{formatCurrency(job.total, currency)}</span>
          {job.status === "completed" && (
            <Badge variant="secondary" className={`border-0 text-[9px] font-bold px-1.5 py-0 ${isPaid ? "icon-green " : "icon-orange "}`}>
              {isPaid ? "Paid" : "Unpaid"}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
