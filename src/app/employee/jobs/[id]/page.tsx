"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useVoiceNote } from "@/hooks/useVoiceNote";

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
  scheduled:   { label: "Scheduled",   color: "#007AFF", bg: "bg-primary/10" },
  in_progress: { label: "In Progress", color: "#ea580c", bg: "bg-status-in-progress/10" },
  completed:   { label: "Completed",   color: "#16a34a", bg: "bg-status-completed/10" },
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

  // Voice note
  const voice = useVoiceNote();
  const [voiceNoteText, setVoiceNoteText] = useState("");
  const [savingVoiceNote, setSavingVoiceNote] = useState(false);
  const [voiceNoteSaved, setVoiceNoteSaved] = useState(false);
  const handleVoiceTranscript = useCallback((text: string) => {
    setVoiceNoteText((prev) => prev ? prev + " " + text : text);
  }, []);

  // Clock in/out
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [clocking, setClocking] = useState(false);

  // Supplies / inventory usage
  const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; category: string; quantity: number }[]>([]);
  const [supplyItemId, setSupplyItemId] = useState("");
  const [supplyQty, setSupplyQty] = useState("1");
  const [supplyNotes, setSupplyNotes] = useState("");
  const [supplySaving, setSupplySaving] = useState(false);
  const [supplySuccess, setSupplySuccess] = useState(false);

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

  // Upsell suggestions
  const [upsellSuggestions, setUpsellSuggestions] = useState<{ title: string; pitch: string; icon: string }[]>([]);
  const [upsellLoading, setUpsellLoading] = useState(false);

  // Neighbor referral
  const [refOpen, setRefOpen] = useState(false);
  const [refName, setRefName] = useState("");
  const [refAddress, setRefAddress] = useState("");
  const [refPhone, setRefPhone] = useState("");
  const [refNotes, setRefNotes] = useState("");
  const [refHeat, setRefHeat] = useState<"hot" | "warm" | "cool">("warm");
  const [refSaving, setRefSaving] = useState(false);
  const [refSuccess, setRefSuccess] = useState(false);

  // Competitor intel
  const [intelOpen, setIntelOpen] = useState(false);
  const [intelCompetitor, setIntelCompetitor] = useState("");
  const [intelType, setIntelType] = useState("truck_spotted");
  const [intelPrice, setIntelPrice] = useState("");
  const [intelNotes, setIntelNotes] = useState("");
  const [intelSaving, setIntelSaving] = useState(false);
  const [intelSuccess, setIntelSuccess] = useState(false);

  // Signature
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [sigSaving, setSigSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  const swipeSig = useSwipeToDismiss(() => setSigModalOpen(false), sigModalOpen);

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

      const { data: invData } = await supabase
        .from("inventory_items")
        .select("id, name, category, quantity")
        .eq("business_id", j.business_id)
        .eq("is_active", true)
        .order("name");
      setInventoryItems((invData ?? []) as { id: string; name: string; category: string; quantity: number }[]);

      setLoading(false);
    }
    load();
  }, [id]);

  async function saveVoiceNote() {
    if (!job || !voiceNoteText.trim()) return;
    setSavingVoiceNote(true);
    const supabase = createClient();
    const newNote = job.notes ? job.notes + "\n" + voiceNoteText.trim() : voiceNoteText.trim();
    await supabase.from("jobs").update({ notes: newNote }).eq("id", job.id);
    setJob((j) => j ? { ...j, notes: newNote } : j);
    setVoiceNoteText("");
    setSavingVoiceNote(false);
    setVoiceNoteSaved(true);
    setTimeout(() => setVoiceNoteSaved(false), 2000);
  }

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

  async function logSupplyUsage() {
    if (!job || !employeeId || !supplyItemId) return;
    setSupplySaving(true);
    const supabase = createClient();

    const qty = parseFloat(supplyQty) || 1;
    const selectedItem = inventoryItems.find((i) => i.id === supplyItemId);

    await supabase.from("inventory_usage").insert({
      item_id: supplyItemId,
      job_id: job.id,
      quantity_used: qty,
      logged_by: employeeId,
      notes: supplyNotes || null,
    });

    // Decrement quantity for parts
    if (selectedItem?.category === "part") {
      const newQty = Math.max(0, selectedItem.quantity - qty);
      await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", supplyItemId);
      setInventoryItems((items) =>
        items.map((i) => i.id === supplyItemId ? { ...i, quantity: newQty } : i)
      );
    }

    setSupplyItemId("");
    setSupplyQty("1");
    setSupplyNotes("");
    setSupplySuccess(true);
    setSupplySaving(false);
    setTimeout(() => setSupplySuccess(false), 3000);
  }

  function getCanvasCoords(canvas: HTMLCanvasElement, e: React.PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onSigPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onSigPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(canvas, e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function onSigPointerUp() {
    isDrawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function saveSignatureAndComplete() {
    if (!job) return;
    setSigSaving(true);
    const canvas = canvasRef.current;
    const supabase = createClient();

    if (canvas) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        const path = `${job.id}/signature.png`;
        const { error } = await supabase.storage
          .from("signatures")
          .upload(path, blob, { upsert: true, contentType: "image/png" });
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from("signatures").getPublicUrl(path);
          await supabase.from("jobs").update({
            status: "completed",
            completed_at: new Date().toISOString(),
            signature_url: publicUrl,
          }).eq("id", job.id);
          setJob((j) => j ? { ...j, status: "completed" } : j);
          setSigModalOpen(false);
          setSigSaving(false);
          fetchUpsell(job.id);
          return;
        }
      }
    }

    // Fallback: complete without signature
    await supabase.from("jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);
    setJob((j) => j ? { ...j, status: "completed" } : j);
    setSigModalOpen(false);
    setSigSaving(false);
    fetchUpsell(job.id);
  }

  function fetchUpsell(jobId: string) {
    setUpsellLoading(true);
    fetch("/api/upsell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.suggestions?.length) setUpsellSuggestions(d.suggestions); })
      .catch(() => {})
      .finally(() => setUpsellLoading(false));
  }

  async function submitIntel() {
    if (!job || !employeeId || !intelCompetitor.trim()) return;
    setIntelSaving(true);
    const supabase = createClient();
    await supabase.from("competitor_intel").insert({
      business_id: job.business_id,
      job_id: job.id,
      team_member_id: employeeId,
      competitor_name: intelCompetitor.trim(),
      observation_type: intelType,
      price_amount: intelType === "price_info" && intelPrice ? parseFloat(intelPrice) : null,
      notes: intelNotes.trim() || null,
    });
    setIntelCompetitor("");
    setIntelType("truck_spotted");
    setIntelPrice("");
    setIntelNotes("");
    setIntelSaving(false);
    setIntelSuccess(true);
    setIntelOpen(false);
    setTimeout(() => setIntelSuccess(false), 3000);
  }

  async function submitReferral() {
    if (!job || !refName.trim() || !refAddress.trim()) return;
    setRefSaving(true);
    const supabase = createClient();
    const heatNote = { hot: "Hot lead", warm: "Warm lead", cool: "Just browsing" }[refHeat];
    const fullNotes = [heatNote, refNotes.trim()].filter(Boolean).join(" — ");
    await supabase.from("leads").insert({
      business_id: job.business_id,
      name: refName.trim(),
      address: refAddress.trim(),
      phone: refPhone.trim() || null,
      stage: "new",
      source: "Neighbor Referral",
      notes: fullNotes || null,
      referral_job_id: job.id,
    });
    setRefName("");
    setRefAddress("");
    setRefPhone("");
    setRefNotes("");
    setRefHeat("warm");
    setRefSaving(false);
    setRefSuccess(true);
    setRefOpen(false);
    setTimeout(() => setRefSuccess(false), 3000);
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
        <button onClick={() => router.back()} className="text-sm font-bold text-primary">
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
                className="text-xs font-bold text-primary mt-0.5"
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
              <a href={`tel:${job.clients.phone}`} className="text-sm font-bold text-primary">
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

        {/* Voice Note */}
        <div className="p-4 flex flex-col gap-3 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Add Note</span>
            {voice.supported && (
              <button
                type="button"
                onClick={() => voice.listening ? voice.stop() : voice.start(handleVoiceTranscript)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  voice.listening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {voice.listening ? "stop" : "mic"}
                </span>
                {voice.listening ? "Stop" : "Dictate"}
              </button>
            )}
          </div>
          <textarea
            rows={3}
            placeholder="Type or dictate a note…"
            value={voice.listening && voice.interim ? voiceNoteText + " " + voice.interim : voiceNoteText}
            onChange={(e) => setVoiceNoteText(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/40 resize-none"
          />
          {voice.error && <p className="text-xs text-red-500">{voice.error}</p>}
          {voice.listening && <p className="text-xs text-primary animate-pulse">Listening… speak your note</p>}
          {voiceNoteText.trim() && (
            <button
              onClick={saveVoiceNote}
              disabled={savingVoiceNote}
              className="self-end px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {voiceNoteSaved ? "Saved!" : savingVoiceNote ? "Saving…" : "Save Note"}
            </button>
          )}
        </div>
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
              ? "icon-orange  border-2 border-[var(--color-status-in-progress)]/20"
              : "icon-green  border-2 border-[var(--color-status-completed)]/20"
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
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_circle
          </span>
          {updating ? "Updating…" : "Start Job"}
        </button>
      )}

      {job.status === "in_progress" && (
        <button
          onClick={() => setSigModalOpen(true)}
          disabled={updating}
          className="w-full py-4 rounded-2xl bg-[var(--color-status-completed)] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
          Mark Complete
        </button>
      )}

      {/* ── Upsell suggestions ── */}
      {job.status === "completed" && (upsellLoading || upsellSuggestions.length > 0) && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 pt-3.5 pb-3 flex items-center gap-2.5 border-b border-border/50">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-[17px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
            </div>
            <div>
              <p className="text-xs font-extrabold text-foreground">Upsell Ideas for the Boss</p>
              <p className="text-[11px] text-muted-foreground">Tell the owner about these opportunities</p>
            </div>
          </div>
          {upsellLoading ? (
            <div className="flex items-center gap-2 px-4 py-4">
              <span className="material-symbols-outlined text-[16px] text-muted-foreground animate-spin">progress_activity</span>
              <span className="text-xs text-muted-foreground">Generating suggestions…</span>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {upsellSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="material-symbols-outlined text-[20px] text-primary mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-foreground">{s.title}</span>
                    <span className="text-xs text-muted-foreground">{s.pitch}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
                  className="relative aspect-square rounded-2xl border-2 border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98] transition-all disabled:opacity-60"
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
          <div className="flex items-center gap-2 icon-green  rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-sm font-bold">Payment recorded!</span>
          </div>
        )}

        {tipSuccess && (
          <div className="flex items-center gap-2 icon-green  rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-sm font-bold">Tip recorded!</span>
          </div>
        )}

        {/* Payment action buttons */}
        {paySection === null && (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaySection("cash")}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97] transition-all"
            >
              <span className="material-symbols-outlined text-[22px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
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
              className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-border bg-card hover:border-[var(--color-status-completed)]/20 hover:opacity-90 active:scale-[0.97] transition-all"
            >
              <span className="material-symbols-outlined text-[22px] text-[var(--color-status-completed)]" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
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
                        ? "border-primary bg-primary/10 text-primary"
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
                  step="0.1"
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
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
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
                className="shrink-0 text-xs font-bold text-primary"
              >
                Copy
              </button>
            </div>
            {job.clients?.phone && (
              <a
                href={`sms:${job.clients.phone}?body=${encodeURIComponent(`Hi ${job.clients.name}! Here's your invoice link: ${invoiceUrl}`)}`}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-[0.98] transition-all"
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
                  step="0.1"
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
              className="w-full py-3.5 rounded-xl bg-[var(--color-status-completed)] text-white font-bold text-sm shadow-md shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {tipSaving ? "Recording…" : `Record $${tipAmount || "0.00"} Tip`}
            </button>
          </div>
        )}
      </div>

      {/* ── Supplies Used ── */}
      {inventoryItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Log Supplies Used</h2>

          {supplySuccess && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="text-sm font-bold">Usage logged!</span>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item</label>
              <select
                value={supplyItemId}
                onChange={(e) => setSupplyItemId(e.target.value)}
                className="h-12 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select item…</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.category === "part" ? ` (${item.quantity} left)` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantity</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={supplyQty}
                  onChange={(e) => setSupplyQty(e.target.value)}
                  className="h-12 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-[2]">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Used full bottle"
                  value={supplyNotes}
                  onChange={(e) => setSupplyNotes(e.target.value)}
                  className="h-12 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <button
              onClick={logSupplyUsage}
              disabled={supplySaving || !supplyItemId}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {supplySaving ? "Logging…" : "Log Usage"}
            </button>
          </div>
        </div>
      )}

      {/* ── Competitor Intel ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Competitive Intel</h2>

        {intelSuccess && (
          <div className="flex items-center gap-2 icon-green rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-sm font-bold">Intel logged!</span>
          </div>
        )}

        {!intelOpen ? (
          <button
            onClick={() => setIntelOpen(true)}
            className="flex items-center gap-3 w-full py-4 px-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] transition-all"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[18px]">visibility</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold text-foreground">Report Competitor</span>
              <span className="text-xs text-muted-foreground">Spotted a rival? Log it for the boss</span>
            </div>
          </button>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Report Competitor</span>
              <button onClick={() => setIntelOpen(false)} className="text-xs font-bold text-muted-foreground">Cancel</button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Competitor Name</label>
              <input
                type="text"
                placeholder="e.g. Green Clean Co."
                value={intelCompetitor}
                onChange={(e) => setIntelCompetitor(e.target.value)}
                className="h-12 rounded-xl border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What did you see?</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "truck_spotted",      label: "Truck spotted",      icon: "local_shipping" },
                  { value: "yard_sign",           label: "Yard sign",          icon: "signpost" },
                  { value: "customer_mentioned",  label: "Customer mentioned", icon: "chat_bubble" },
                  { value: "price_info",          label: "Price info",         icon: "sell" },
                  { value: "quality_note",        label: "Quality note",       icon: "star" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIntelType(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                      intelType === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {intelType === "price_info" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price mentioned</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={intelPrice}
                    onChange={(e) => setIntelPrice(e.target.value)}
                    className="w-full h-12 rounded-xl border border-border bg-transparent pl-7 pr-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notes <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Any extra details…"
                value={intelNotes}
                onChange={(e) => setIntelNotes(e.target.value)}
                className="rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            <button
              onClick={submitIntel}
              disabled={intelSaving || !intelCompetitor.trim()}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {intelSaving ? "Logging…" : "Log Intel"}
            </button>
          </div>
        )}
      </div>

      {/* ── Neighbor Referral ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Neighbor Leads</h2>

        {refSuccess && (
          <div className="flex items-center gap-2 icon-green rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-sm font-bold">Lead logged for the boss!</span>
          </div>
        )}

        {!refOpen ? (
          <button
            onClick={() => {
              setRefOpen(true);
              if (job.clients?.address) setRefAddress("");
            }}
            className="flex items-center gap-3 w-full py-4 px-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] transition-all"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[18px]">handshake</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold text-foreground">Log a Neighbor Lead</span>
              <span className="text-xs text-muted-foreground">Neighbor interested? Add them to the pipeline</span>
            </div>
          </button>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Log a Neighbor Lead</span>
              <button onClick={() => setRefOpen(false)} className="text-xs font-bold text-muted-foreground">Cancel</button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Neighbor Name *</label>
              <input
                type="text"
                placeholder="e.g. John Smith"
                value={refName}
                onChange={(e) => setRefName(e.target.value)}
                className="h-12 rounded-xl border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Their Address *</label>
              <input
                type="text"
                placeholder={job.clients?.address ? `Near ${job.clients.address}` : "123 Oak St"}
                value={refAddress}
                onChange={(e) => setRefAddress(e.target.value)}
                className="h-12 rounded-xl border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Phone <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={refPhone}
                onChange={(e) => setRefPhone(e.target.value)}
                className="h-12 rounded-xl border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How interested?</label>
              <div className="flex gap-2">
                {([
                  { value: "hot",  label: "Hot",          icon: "local_fire_department" },
                  { value: "warm", label: "Warm",         icon: "thumb_up"             },
                  { value: "cool", label: "Just browsing", icon: "remove_red_eye"       },
                ] as { value: "hot" | "warm" | "cool"; label: string; icon: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRefHeat(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                      refHeat === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                What do they want? <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Wants a quote on lawn care…"
                value={refNotes}
                onChange={(e) => setRefNotes(e.target.value)}
                className="rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            <button
              onClick={submitReferral}
              disabled={refSaving || !refName.trim() || !refAddress.trim()}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {refSaving ? "Logging…" : "Add to Pipeline"}
            </button>
          </div>
        )}
      </div>

      {/* ── Signature Modal ── */}
      {sigModalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => !sigSaving && setSigModalOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border flex flex-col overflow-hidden" ref={swipeSig.sheetRef} {...swipeSig.sheetDragProps}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pt-2 pb-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-status-completed/10">
                  <span className="material-symbols-outlined text-[26px] text-[var(--color-status-completed)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    draw
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground leading-tight">Customer Signature</h2>
                  <p className="text-sm text-muted-foreground">Ask the client to sign below</p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3 shrink-0">
              <div className="rounded-2xl border-2 border-dashed border-border bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full touch-none"
                  style={{ cursor: "crosshair" }}
                  onPointerDown={onSigPointerDown}
                  onPointerMove={onSigPointerMove}
                  onPointerUp={onSigPointerUp}
                  onPointerLeave={onSigPointerUp}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearSignature}
                  disabled={sigSaving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-muted-foreground border border-border bg-muted/30 hover:bg-muted transition-colors disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  onClick={saveSignatureAndComplete}
                  disabled={sigSaving}
                  className="flex-[2] py-3 rounded-xl text-sm font-bold bg-[var(--color-status-completed)] text-white shadow-md shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                  {sigSaving ? "Saving…" : "Save & Complete"}
                </button>
              </div>
              <button
                onClick={() => setSigModalOpen(false)}
                disabled={sigSaving}
                className="w-full py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
