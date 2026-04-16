"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  { label: "8 AM",  value: "08:00", hour: 8  },
  { label: "9 AM",  value: "09:00", hour: 9  },
  { label: "10 AM", value: "10:00", hour: 10 },
  { label: "11 AM", value: "11:00", hour: 11 },
  { label: "12 PM", value: "12:00", hour: 12 },
  { label: "1 PM",  value: "13:00", hour: 13 },
  { label: "2 PM",  value: "14:00", hour: 14 },
  { label: "3 PM",  value: "15:00", hour: 15 },
  { label: "4 PM",  value: "16:00", hour: 16 },
  { label: "5 PM",  value: "17:00", hour: 17 },
];

async function loadBookedHours(businessId: string, date: string): Promise<Set<number>> {
  const supabase = createClient();
  const dayStart = new Date(date + "T00:00:00").toISOString();
  const dayEnd   = new Date(date + "T23:59:59").toISOString();
  const { data } = await supabase
    .from("jobs")
    .select("scheduled_at")
    .eq("business_id", businessId)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd)
    .neq("status", "cancelled");
  return new Set<number>(
    (data ?? [])
      .filter((j): j is { scheduled_at: string } => !!j.scheduled_at)
      .map((j) => new Date(j.scheduled_at).getHours())
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";

type Lead = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  phone_alt: string | null;
  email: string | null;
  address: string | null;
  stage: LeadStage;
  source: string | null;
  notes: string | null;
  rapport_notes: string | null;
  service_notes: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  custom_field_values: Record<string, unknown> | null;
  estimated_value: number | null;
  created_at: string;
};

type CustomField = {
  id: string;
  label: string;
  field_type: "text" | "number" | "boolean" | "select";
  options: string[] | null;
  required: boolean;
  position: number;
};

type LeadPhoto = {
  id: string;
  url: string;
  caption: string | null;
  created_at: string;
};

type TeamMember = { id: string; name: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: { value: LeadStage; label: string; color: string; bg: string; icon: string }[] = [
  { value: "new",       label: "New",       color: "#6b7280", bg: "bg-gray-500/10",  icon: "person_add" },
  { value: "contacted", label: "Contacted", color: "#007AFF", bg: "bg-primary/10",   icon: "phone_in_talk" },
  { value: "quoted",    label: "Quoted",    color: "#f59e0b", bg: "bg-amber-500/10", icon: "request_quote" },
  { value: "won",       label: "Won",       color: "#16a34a", bg: "bg-green-600/10", icon: "check_circle" },
  { value: "lost",      label: "Lost",      color: "#dc2626", bg: "bg-red-600/10",   icon: "cancel" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [lead, setLead] = useState<Lead | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [photos, setPhotos] = useState<LeadPhoto[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);

  // Photo upload state
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Schedule Job modal state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [schedBookedHours, setSchedBookedHours] = useState<Set<number>>(new Set());
  const [schedSlotsLoading, setSchedSlotsLoading] = useState(false);
  const [schedMember, setSchedMember] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [schedDone, setSchedDone] = useState(false);

  // Preferred time slots (edit mode)
  const [prefBookedHours, setPrefBookedHours] = useState<Set<number>>(new Set());
  const [prefSlotsLoading, setPrefSlotsLoading] = useState(false);

  // Converting to client
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

      if (!leadData) { router.replace("/leads"); return; }
      const l = leadData as Lead;
      setLead(l);
      setForm({
        name: l.name,
        phone: l.phone,
        phone_alt: l.phone_alt,
        email: l.email,
        address: l.address,
        stage: l.stage,
        estimated_value: l.estimated_value,
        rapport_notes: l.rapport_notes,
        service_notes: l.service_notes,
        preferred_date: l.preferred_date,
        preferred_time: l.preferred_time,
      });

      // Pre-fill schedule modal with preferred date if set
      if (l.preferred_date) setSchedDate(l.preferred_date);

      const [{ data: cfs }, { data: ph }, { data: members }] = await Promise.all([
        supabase.from("canvassing_custom_fields")
          .select("id, label, field_type, options, required, position")
          .eq("business_id", l.business_id)
          .order("position"),
        supabase.from("lead_photos")
          .select("id, url, caption, created_at")
          .eq("lead_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("team_members")
          .select("id, name")
          .eq("business_id", l.business_id)
          .eq("is_active", true)
          .eq("is_pending", false)
          .order("name"),
      ]);

      setCustomFields((cfs as CustomField[]) ?? []);
      setPhotos((ph as LeadPhoto[]) ?? []);
      setTeamMembers((members as TeamMember[]) ?? []);
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load booked hours for schedule modal when date changes
  useEffect(() => {
    if (!schedDate || !lead?.business_id) { setSchedBookedHours(new Set()); setSchedTime(""); return; }
    setSchedSlotsLoading(true);
    setSchedTime(""); // reset time on date change
    loadBookedHours(lead.business_id, schedDate).then((hours) => {
      setSchedBookedHours(hours);
      setSchedSlotsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedDate, lead?.business_id]);

  // Load booked hours for preferred time edit when form date changes
  useEffect(() => {
    if (!form.preferred_date || !lead?.business_id) { setPrefBookedHours(new Set()); return; }
    setPrefSlotsLoading(true);
    loadBookedHours(lead.business_id, form.preferred_date).then((hours) => {
      setPrefBookedHours(hours);
      setPrefSlotsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.preferred_date, lead?.business_id]);

  async function saveEdits() {
    if (!lead || !form.name?.trim()) return;
    setSaving(true);
    const { data: updated } = await supabase.from("leads")
      .update({
        name: form.name?.trim(),
        phone: form.phone || null,
        phone_alt: form.phone_alt || null,
        email: form.email || null,
        address: form.address || null,
        stage: form.stage,
        estimated_value: form.estimated_value ?? null,
        rapport_notes: form.rapport_notes || null,
        service_notes: form.service_notes || null,
        preferred_date: form.preferred_date || null,
        preferred_time: form.preferred_time || null,
      })
      .eq("id", lead.id)
      .select("*")
      .single();
    if (updated) setLead(updated as Lead);
    setSaving(false);
    setEditing(false);
  }

  async function updateStage(stage: LeadStage) {
    if (!lead) return;
    await supabase.from("leads").update({ stage }).eq("id", lead.id);
    setLead((l) => l ? { ...l, stage } : l);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!lead) return;
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${lead.id}/${Date.now()}.${ext}`;
      const { data: uploaded } = await supabase.storage.from("lead-photos").upload(path, file, { upsert: false });
      if (uploaded) {
        const { data: { publicUrl } } = supabase.storage.from("lead-photos").getPublicUrl(path);
        const { data: photo } = await supabase.from("lead_photos").insert({
          lead_id: lead.id,
          business_id: lead.business_id,
          url: publicUrl,
        }).select("id, url, caption, created_at").single();
        if (photo) setPhotos((prev) => [photo as LeadPhoto, ...prev]);
      }
    }
    setUploading(false);
  }

  async function deletePhoto(photoId: string, url: string) {
    await supabase.from("lead_photos").delete().eq("id", photoId);
    // Extract path from URL and delete from storage
    const pathMatch = url.match(/lead-photos\/(.+)$/);
    if (pathMatch) await supabase.storage.from("lead-photos").remove([pathMatch[1]]);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  async function scheduleJob() {
    if (!lead || !schedDate) return;
    setScheduling(true);

    // Find or create client
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("business_id", lead.business_id)
      .ilike("name", lead.name)
      .maybeSingle();

    let clientId: string;
    if (existingClient) {
      clientId = (existingClient as { id: string }).id;
    } else {
      const { data: newClient } = await supabase.from("clients").insert({
        business_id: lead.business_id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
      }).select("id").single();
      if (!newClient) { setScheduling(false); return; }
      clientId = (newClient as { id: string }).id;
    }

    const scheduledAt = schedTime
      ? new Date(`${schedDate}T${schedTime}`).toISOString()
      : new Date(`${schedDate}T09:00:00`).toISOString();

    await supabase.from("jobs").insert({
      business_id: lead.business_id,
      client_id: clientId,
      status: "scheduled",
      scheduled_at: scheduledAt,
      assigned_member_id: schedMember || null,
      notes: `Booked via Lead: ${lead.name}`,
    });

    // Mark lead as won
    await updateStage("won");

    setScheduling(false);
    setSchedDone(true);
    setScheduleOpen(false);
  }

  async function convertToClient() {
    if (!lead) return;
    setConverting(true);
    const { data: client, error } = await supabase.from("clients").insert({
      business_id: lead.business_id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      notes: lead.notes,
    }).select("id").single();
    if (!error && client) {
      await updateStage("won");
      router.push(`/clients/${(client as { id: string }).id}`);
    }
    setConverting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!lead) return null;

  const currentStage = STAGES.find((s) => s.value === lead.stage)!;
  const cfValues = lead.custom_field_values ?? {};

  const inputCls = "w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40";
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1";

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-8 pt-4 pb-12">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold text-foreground truncate">{lead.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${currentStage.bg}`}
              style={{ color: currentStage.color }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>{currentStage.icon}</span>
              {currentStage.label}
            </span>
            {lead.source && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{lead.source}</span>
            )}
          </div>
        </div>
        <button onClick={() => setEditing(!editing)}
          className={`flex size-9 items-center justify-center rounded-xl transition-colors shrink-0 ${editing ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          <span className="material-symbols-outlined text-[18px]">{editing ? "check" : "edit"}</span>
        </button>
      </div>

      {/* ── Two-column layout on desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4">

          {/* Contact card */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</p>
            {editing ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className={labelCls}>Name *</label>
                  <input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input type="tel" className={inputCls} value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Alt Phone</label>
                    <input type="tel" className={inputCls} value={form.phone_alt ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone_alt: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" className={inputCls} value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <input className={inputCls} value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Estimated Value ($)</label>
                  <input type="number" min="0" step="0.01" className={inputCls} value={form.estimated_value ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value ? parseFloat(e.target.value) : null }))} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[16px] text-muted-foreground">phone</span>
                    {lead.phone}
                  </a>
                )}
                {lead.phone_alt && (
                  <a href={`tel:${lead.phone_alt}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[16px] text-muted-foreground">phone_forwarded</span>
                    {lead.phone_alt}
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors truncate">
                    <span className="material-symbols-outlined text-[16px] text-muted-foreground">mail</span>
                    {lead.email}
                  </a>
                )}
                {lead.address && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">location_on</span>
                    {lead.address}
                  </p>
                )}
                {lead.estimated_value != null && lead.estimated_value > 0 && (
                  <p className="flex items-center gap-2 text-sm font-bold text-primary">
                    <span className="material-symbols-outlined text-[16px] text-muted-foreground">attach_money</span>
                    ${lead.estimated_value.toFixed(0)} est. value
                  </p>
                )}
                {!lead.phone && !lead.email && !lead.address && (
                  <p className="text-sm text-muted-foreground">No contact details</p>
                )}
              </div>
            )}
          </div>

          {/* Stage selector */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stage</p>
            {editing ? (
              <div className="flex flex-col gap-1">
                <select className={inputCls} value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as LeadStage }))}>
                  {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {STAGES.map((s) => (
                  <button key={s.value} onClick={() => updateStage(s.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                      lead.stage === s.value ? "text-white border-transparent" : "bg-card text-muted-foreground border-border"
                    }`}
                    style={lead.stage === s.value ? { backgroundColor: s.color, borderColor: s.color } : {}}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rapport Notes */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rapport Notes</p>
            {editing ? (
              <textarea className={`${inputCls} resize-none`} rows={3}
                placeholder="Customer's profession, pets, years in home…"
                value={form.rapport_notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, rapport_notes: e.target.value }))} />
            ) : (
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {lead.rapport_notes || <span className="text-muted-foreground italic">No rapport notes</span>}
              </p>
            )}
          </div>

          {/* Service Notes */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Service Notes</p>
            {editing ? (
              <textarea className={`${inputCls} resize-none`} rows={3}
                placeholder="Gate code, watch flower beds, 3 dogs…"
                value={form.service_notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, service_notes: e.target.value }))} />
            ) : (
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {lead.service_notes || <span className="text-muted-foreground italic">No service notes</span>}
              </p>
            )}
          </div>

          {/* Save/cancel when editing */}
          {editing && (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} disabled={saving}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-muted-foreground disabled:opacity-50">
                Cancel
              </button>
              <button onClick={saveEdits} disabled={saving || !form.name?.trim()}
                className="flex-[2] py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-4">

          {/* Appointment card */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Appointment</p>
            {editing ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className={labelCls}>Preferred Date</label>
                  <input type="date" className={inputCls} value={form.preferred_date ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, preferred_date: e.target.value, preferred_time: null }))} />
                </div>
                <div>
                  <label className={labelCls}>Preferred Time</label>
                  {!form.preferred_date ? (
                    <p className="text-xs text-muted-foreground/60 mt-1">Pick a date to see available times</p>
                  ) : prefSlotsLoading ? (
                    <p className="text-xs text-muted-foreground mt-1">Checking availability…</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-1.5 mt-1">
                      {TIME_SLOTS.map((slot) => {
                        const isBooked = prefBookedHours.has(slot.hour);
                        const isSelected = form.preferred_time === slot.label;
                        return (
                          <button key={slot.value} type="button" disabled={isBooked}
                            onClick={() => setForm((f) => ({ ...f, preferred_time: isSelected ? null : slot.label }))}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                              isBooked
                                ? "bg-muted/20 text-muted-foreground/30 border-border/20 cursor-not-allowed line-through"
                                : isSelected
                                  ? "bg-primary text-white border-primary shadow-sm"
                                  : "bg-muted/30 text-foreground border-border hover:border-primary/40"
                            }`}>
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lead.preferred_date ? (
                  <>
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <span className="material-symbols-outlined text-[16px] text-muted-foreground">calendar_today</span>
                      {new Date(lead.preferred_date + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "long", day: "numeric" })}
                    </p>
                    {lead.preferred_time && (
                      <p className="flex items-center gap-2 text-sm text-foreground">
                        <span className="material-symbols-outlined text-[16px] text-muted-foreground">schedule</span>
                        {lead.preferred_time}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No appointment set</p>
                )}
              </div>
            )}
            {!editing && (
              <div className="flex gap-2 pt-1">
                {schedDone ? (
                  <p className="text-xs font-bold text-green-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Job scheduled
                  </p>
                ) : (
                  <button onClick={() => setScheduleOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-[14px]">event_available</span>
                    Schedule Job
                  </button>
                )}
                <button onClick={convertToClient} disabled={converting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600/10 text-green-700 text-xs font-bold border border-green-600/20 active:scale-95 transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined text-[14px]">person_check</span>
                  {converting ? "Converting…" : "Convert to Client"}
                </button>
              </div>
            )}
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Custom Fields</p>
              <div className="flex flex-col gap-3">
                {customFields.map((cf) => {
                  const val = cfValues[cf.id];
                  return (
                    <div key={cf.id} className="flex items-start justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{cf.label}</span>
                      <span className="text-xs font-semibold text-foreground text-right">
                        {val === undefined || val === null || val === ""
                          ? <span className="text-muted-foreground/50">—</span>
                          : cf.field_type === "boolean"
                            ? (val ? "Yes" : "No")
                            : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Photos */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Photos</p>
              <button onClick={() => photoInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-muted text-muted-foreground text-[11px] font-bold hover:text-foreground transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-[13px]">{uploading ? "hourglass_empty" : "add_a_photo"}</span>
                {uploading ? "Uploading…" : "Add Photo"}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
            </div>
            {photos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No photos yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group aspect-video rounded-xl overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => deletePhoto(photo.id, photo.url)}
                      className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-[13px] text-white">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activity</p>
            <p className="text-xs text-muted-foreground">
              Created {new Date(lead.created_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
            </p>
            {lead.source && (
              <p className="text-xs text-muted-foreground">Source: {lead.source}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Schedule Job modal ── */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setScheduleOpen(false)}>
          <div className="w-full max-w-lg bg-card rounded-t-3xl border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/50">
              <h2 className="font-extrabold text-base text-foreground">Schedule Job</h2>
              <button onClick={() => setScheduleOpen(false)} className="text-muted-foreground hover:text-foreground">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <label className={labelCls}>Date *</label>
                <input type="date" className={inputCls} value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Time</label>
                {!schedDate ? (
                  <p className="text-xs text-muted-foreground/60 mt-1">Pick a date first</p>
                ) : schedSlotsLoading ? (
                  <p className="text-xs text-muted-foreground mt-1">Checking availability…</p>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5 mt-1">
                    {TIME_SLOTS.map((slot) => {
                      const isBooked = schedBookedHours.has(slot.hour);
                      const isSelected = schedTime === slot.value;
                      return (
                        <button key={slot.value} type="button" disabled={isBooked}
                          onClick={() => setSchedTime(isSelected ? "" : slot.value)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                            isBooked
                              ? "bg-muted/20 text-muted-foreground/30 border-border/20 cursor-not-allowed line-through"
                              : isSelected
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-muted/30 text-foreground border-border hover:border-primary/40"
                          }`}>
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {teamMembers.length > 0 && (
                <div>
                  <label className={labelCls}>Assign Rep</label>
                  <select className={inputCls} value={schedMember} onChange={(e) => setSchedMember(e.target.value)}>
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border/50 flex gap-3">
              <button onClick={() => setScheduleOpen(false)} disabled={scheduling}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-foreground bg-muted/40 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={scheduleJob} disabled={scheduling || !schedDate}
                className="flex-[2] py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform">
                {scheduling ? "Scheduling…" : "Confirm Job →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
