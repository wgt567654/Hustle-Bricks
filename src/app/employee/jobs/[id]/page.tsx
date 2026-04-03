"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type Job = {
  id: string;
  status: JobStatus;
  scheduled_at: string | null;
  total: number;
  notes: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  business_id: string;
  clients: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  job_line_items: { id: string; description: string; quantity: number; unit_price: number }[];
};

type TimeEntry = {
  id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
};

const STATUS_META: Record<JobStatus, { label: string; color: string; bg: string }> = {
  scheduled:   { label: "Scheduled",   color: "#007AFF", bg: "bg-[#007AFF]/10" },
  in_progress: { label: "In Progress", color: "#ea580c", bg: "bg-[#ea580c]/10" },
  completed:   { label: "Completed",   color: "#16a34a", bg: "bg-[#16a34a]/10" },
  cancelled:   { label: "Cancelled",   color: "#6b7280", bg: "bg-muted" },
};

function formatScheduled(dateStr: string | null) {
  if (!dateStr) return "Not scheduled";
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  );
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const PAYMENT_METHODS = [
  { value: "cash",  label: "Cash",  icon: "payments"    },
  { value: "check", label: "Check", icon: "receipt"     },
  { value: "venmo", label: "Venmo", icon: "phone_iphone" },
  { value: "zelle", label: "Zelle", icon: "phone_iphone" },
];

export default function EmployeeJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Clock in/out
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [clocking, setClocking] = useState(false);

  // Photos
  const [uploadingPhoto, setUploadingPhoto] = useState<"before" | "after" | null>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef  = useRef<HTMLInputElement>(null);

  // Payment
  const [paySection, setPaySection] = useState<"cash" | "stripe" | "tip" | null>(null);
  const [payMethod, setPayMethod]   = useState("cash");
  const [payAmount, setPayAmount]   = useState("");
  const [payNotes, setPayNotes]     = useState("");
  const [paySaving, setPaySaving]   = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  // Tip
  const [tipAmount, setTipAmount]  = useState("");
  const [tipSaving, setTipSaving]  = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setNotFound(true); setLoading(false); return; }

      const { data: tm } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!tm) { setNotFound(true); setLoading(false); return; }
      setEmployeeId(tm.id);

      const [{ data: jobData }, { data: entryData }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, scheduled_at, total, notes, before_photo_url, after_photo_url, business_id, clients(name, phone, email, address), job_line_items(id, description, quantity, unit_price)")
          .eq("id", id)
          .eq("assigned_member_id", tm.id)
          .single(),
        supabase
          .from("time_entries")
          .select("id, clocked_in_at, clocked_out_at")
          .eq("employee_id", tm.id)
          .eq("job_id", id)
          .is("clocked_out_at", null)
          .maybeSingle(),
      ]);

      if (!jobData) { setNotFound(true); setLoading(false); return; }
      const j = jobData as unknown as Job;
      setJob(j);
      setPayAmount(j.total.toFixed(2));
      setActiveEntry(entryData as TimeEntry | null);
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
    setJob((j) => j ? { ...j, status } : j);
    setUpdating(false);
  }

  async function toggleClock() {
    if (!employeeId || !job) return;
    setClocking(true);
    const supabase = createClient();

    if (activeEntry) {
      await supabase
        .from("time_entries")
        .update({ clocked_out_at: new Date().toISOString() })
        .eq("id", activeEntry.id);
      setActiveEntry(null);
    } else {
      const { data } = await supabase
        .from("time_entries")
        .insert({ employee_id: employeeId, job_id: job.id, business_id: job.business_id })
        .select("id, clocked_in_at, clocked_out_at")
        .single();
      if (data) setActiveEntry(data as TimeEntry);
    }
    setClocking(false);
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

  async function collectPayment() {
    if (!job) return;
    setPaySaving(true);
    const supabase = createClient();
    await supabase.from("payments").insert({
      business_id: job.business_id,
      job_id: job.id,
      amount: parseFloat(payAmount) || job.total,
      status: "paid",
      paid_at: new Date().toISOString(),
      method: payMethod,
      notes: payNotes || null,
    });
    setPaySaving(false);
    setPaySuccess(true);
    setPaySection(null);
    setTimeout(() => setPaySuccess(false), 3000);
  }

  async function recordTip() {
    if (!job || !tipAmount) return;
    setTipSaving(true);
    const supabase = createClient();
    await supabase.from("payments").insert({
      business_id: job.business_id,
      job_id: job.id,
      amount: parseFloat(tipAmount),
      status: "paid",
      paid_at: new Date().toISOString(),
      method: "tip",
      notes: "Tip",
    });
    setTipSaving(false);
    setTipSuccess(true);
    setTipAmount("");
    setPaySection(null);
    setTimeout(() => setTipSuccess(false), 3000);
  }

  const invoiceUrl = typeof window !== "undefined"
    ? `${window.location.origin}/invoice/${id}`
    : `/invoice/${id}`;

  // ── Loading / Not Found ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">
          work_off
        </span>
        <p className="text-sm font-semibold text-muted-foreground">Job not found</p>
        <button onClick={() => router.back()} className="text-sm font-bold text-[#007AFF]">
          Go back
        </button>
      </div>
    );
  }

  const meta = STATUS_META[job.status];

  return (
    <div className="flex flex-col gap-4 px-4 py-5 max-w-xl mx-auto pb-32">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-extrabold text-lg text-foreground leading-tight truncate">
            {job.job_line_items[0]?.description ?? "Job"}
          </span>
          <span className="text-xs text-muted-foreground">{job.clients?.name ?? ""}</span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.bg}`} style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      {/* Job info card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {job.clients?.address && (
          <div className="p-4 flex items-start gap-3 border-b border-border/50">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[17px]">location_on</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Address</span>
              <span className="text-sm text-foreground">{job.clients.address}</span>
              <a
                href={`https://maps.apple.com/?q=${encodeURIComponent(job.clients.address)}`}
                className="text-xs font-bold text-[#007AFF] mt-0.5"
              >
                Open in Maps
              </a>
            </div>
          </div>
        )}

        <div className="p-4 flex items-start gap-3 border-b border-border/50">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <span className="material-symbols-outlined text-[17px]">schedule</span>
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Scheduled</span>
            <span className="text-sm text-foreground">{formatScheduled(job.scheduled_at)}</span>
          </div>
        </div>

        {job.clients?.phone && (
          <div className="p-4 flex items-start gap-3 border-b border-border/50">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[17px]">call</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Client Phone</span>
              <a href={`tel:${job.clients.phone}`} className="text-sm font-bold text-[#007AFF]">
                {job.clients.phone}
              </a>
            </div>
          </div>
        )}

        {job.notes && (
          <div className="p-4 flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[17px]">notes</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Notes</span>
              <span className="text-sm text-foreground">{job.notes}</span>
            </div>
          </div>
        )}
      </div>

      {/* Services */}
      {job.job_line_items.length > 0 && (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Services</span>
          </div>
          {job.job_line_items.map((item, i) => (
            <div key={item.id} className={`px-4 py-3 flex items-center justify-between ${i > 0 ? "border-t border-border/40" : ""}`}>
              <span className="text-sm text-foreground">{item.description}</span>
              <span className="text-sm font-bold text-foreground">
                ${(item.quantity * item.unit_price).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-muted/30">
            <span className="font-bold text-sm text-foreground">Total</span>
            <span className="font-extrabold text-foreground">${job.total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* ── Actions ── */}

      {/* Clock in/out */}
      {job.status !== "completed" && job.status !== "cancelled" && (
        <button
          onClick={toggleClock}
          disabled={clocking}
          className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
            activeEntry
              ? "bg-[#ea580c]/10 text-[#ea580c] border-2 border-[#ea580c]/25"
              : "bg-[#16a34a]/10 text-[#16a34a] border-2 border-[#16a34a]/25"
          }`}
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {activeEntry ? "logout" : "login"}
          </span>
          {clocking
            ? "…"
            : activeEntry
            ? `Clock Out (in since ${formatTime(activeEntry.clocked_in_at)})`
            : "Clock In"}
        </button>
      )}

      {/* Job status actions */}
      {job.status === "scheduled" && (
        <button
          onClick={() => updateStatus("in_progress")}
          disabled={updating}
          className="w-full py-4 rounded-2xl bg-[#007AFF] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#007AFF]/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_circle
          </span>
          {updating ? "Updating…" : "Start Job"}
        </button>
      )}

      {job.status === "in_progress" && (
        <button
          onClick={() => updateStatus("completed")}
          disabled={updating}
          className="w-full py-4 rounded-2xl bg-[#16a34a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#16a34a]/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
          {updating ? "Updating…" : "Mark Complete"}
        </button>
      )}

      {/* ── Photos ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Photos</h2>
        <div className="grid grid-cols-2 gap-3">
          {(["before", "after"] as const).map((slot) => {
            const url = slot === "before" ? job.before_photo_url : job.after_photo_url;
            const uploading = uploadingPhoto === slot;
            return (
              <div key={slot} className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide text-center">
                  {slot}
                </span>
                <button
                  onClick={() => (slot === "before" ? beforeInputRef : afterInputRef).current?.click()}
                  disabled={uploading}
                  className="relative aspect-square rounded-2xl border-2 border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center hover:border-[#007AFF]/50 hover:bg-[#007AFF]/5 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={`${slot} photo`} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <span className="material-symbols-outlined text-[28px]">
                        {uploading ? "hourglass_top" : "add_a_photo"}
                      </span>
                      <span className="text-[10px] font-bold">{uploading ? "Uploading…" : "Add photo"}</span>
                    </div>
                  )}
                  {url && (
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-[24px] opacity-0 hover:opacity-100">edit</span>
                    </div>
                  )}
                </button>
                <input
                  ref={slot === "before" ? beforeInputRef : afterInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file, slot);
                    e.target.value = "";
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Payment Collection ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collect Payment</h2>

        {paySuccess && (
          <div className="flex items-center gap-2 bg-[#16a34a]/10 text-[#16a34a] rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-sm font-bold">Payment recorded!</span>
          </div>
        )}

        {tipSuccess && (
          <div className="flex items-center gap-2 bg-[#16a34a]/10 text-[#16a34a] rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-sm font-bold">Tip recorded!</span>
          </div>
        )}

        {/* Payment action buttons */}
        {paySection === null && (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaySection("cash")}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-border bg-card hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5 active:scale-[0.97] transition-all"
            >
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              <span className="text-xs font-bold text-foreground">Cash / Check</span>
            </button>
            <button
              onClick={() => setPaySection("stripe")}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-border bg-card hover:border-[#635bff]/40 hover:bg-[#635bff]/5 active:scale-[0.97] transition-all"
            >
              <span className="material-symbols-outlined text-[22px] text-[#635bff]" style={{ fontVariationSettings: "'FILL' 1" }}>credit_card</span>
              <span className="text-xs font-bold text-foreground">Card Link</span>
            </button>
            <button
              onClick={() => setPaySection("tip")}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-border bg-card hover:border-[#16a34a]/40 hover:bg-[#16a34a]/5 active:scale-[0.97] transition-all"
            >
              <span className="material-symbols-outlined text-[22px] text-[#16a34a]" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
              <span className="text-xs font-bold text-foreground">Record Tip</span>
            </button>
          </div>
        )}

        {/* Cash / Check form */}
        {paySection === "cash" && (
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Cash / Check Payment</span>
              <button onClick={() => setPaySection(null)} className="text-xs font-bold text-muted-foreground">Cancel</button>
            </div>

            {/* Method selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Method</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPayMethod(m.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95 ${
                      payMethod === m.value
                        ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
                        : "border-border bg-muted/40 text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full h-12 rounded-xl border border-border bg-transparent pl-7 pr-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notes <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="e.g. Paid in full"
                className="h-12 rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <button
              onClick={collectPayment}
              disabled={paySaving || !payAmount}
              className="w-full py-3.5 rounded-xl bg-[#007AFF] text-white font-bold text-sm shadow-md shadow-[#007AFF]/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {paySaving ? "Recording…" : `Record $${payAmount || "0.00"} Payment`}
            </button>
          </div>
        )}

        {/* Stripe / Card link */}
        {paySection === "stripe" && (
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Send Payment Link</span>
              <button onClick={() => setPaySection(null)} className="text-xs font-bold text-muted-foreground">Cancel</button>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with the client to pay by card via Stripe.
            </p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-3">
              <span className="text-xs text-muted-foreground flex-1 truncate font-mono">{invoiceUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(invoiceUrl);
                }}
                className="shrink-0 text-xs font-bold text-[#007AFF]"
              >
                Copy
              </button>
            </div>
            {job.clients?.phone && (
              <a
                href={`sms:${job.clients.phone}?body=${encodeURIComponent(`Hi ${job.clients.name}! Here's your invoice link: ${invoiceUrl}`)}`}
                className="w-full py-3.5 rounded-xl bg-[#007AFF] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#007AFF]/20 active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>sms</span>
                Text Link to Client
              </a>
            )}
          </div>
        )}

        {/* Tip */}
        {paySection === "tip" && (
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Record a Tip</span>
              <button onClick={() => setPaySection(null)} className="text-xs font-bold text-muted-foreground">Cancel</button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tip Amount</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full h-12 rounded-xl border border-border bg-transparent pl-7 pr-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <button
              onClick={recordTip}
              disabled={tipSaving || !tipAmount || parseFloat(tipAmount) <= 0}
              className="w-full py-3.5 rounded-xl bg-[#16a34a] text-white font-bold text-sm shadow-md shadow-[#16a34a]/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {tipSaving ? "Recording…" : `Record $${tipAmount || "0.00"} Tip`}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
