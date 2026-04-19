"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";

type Lead = {
  id: string;
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

const STAGES: { value: LeadStage; label: string; color: string; bg: string; icon: string }[] = [
  { value: "new",       label: "New",       color: "#6b7280", bg: "bg-gray-500/10",   icon: "person_add" },
  { value: "contacted", label: "Contacted", color: "#007AFF", bg: "bg-primary/10",  icon: "phone_in_talk" },
  { value: "quoted",    label: "Quoted",    color: "#f59e0b", bg: "bg-amber-500/10",  icon: "request_quote" },
  { value: "won",       label: "Won",       color: "#16a34a", bg: "bg-green-600/10",  icon: "check_circle" },
  { value: "lost",      label: "Lost",      color: "#dc2626", bg: "bg-red-600/10",    icon: "cancel" },
];

const SOURCES = ["Referral", "Google", "Door to Door", "Social Media", "Flyer", "Repeat", "Other"];

const BLANK: Omit<Lead, "id" | "created_at"> = {
  name: "", phone: "", phone_alt: "", email: "", address: "", stage: "new",
  source: null, notes: "", rapport_notes: null, service_notes: null,
  preferred_date: null, preferred_time: null, custom_field_values: null,
  estimated_value: null,
};

export default function LeadsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
    if (!biz) return;
    setBusinessId(biz.id);
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("business_id", biz.id)
      .order("created_at", { ascending: false });
    setLeads(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditLead(null);
    setForm(BLANK);
    setModalOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditLead(lead);
    setForm({
      name: lead.name,
      phone: lead.phone ?? "",
      phone_alt: lead.phone_alt ?? "",
      email: lead.email ?? "",
      address: lead.address ?? "",
      stage: lead.stage,
      source: lead.source,
      notes: lead.notes ?? "",
      rapport_notes: lead.rapport_notes,
      service_notes: lead.service_notes,
      preferred_date: lead.preferred_date,
      preferred_time: lead.preferred_time,
      custom_field_values: lead.custom_field_values,
      estimated_value: lead.estimated_value,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !businessId) return;
    setSaving(true);
    const payload = {
      business_id: businessId,
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      stage: form.stage,
      source: form.source || null,
      notes: form.notes || null,
      estimated_value: form.estimated_value ?? null,
    };
    if (editLead) {
      await supabase.from("leads").update(payload).eq("id", editLead.id);
    } else {
      await supabase.from("leads").insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function updateStage(leadId: string, stage: LeadStage) {
    await supabase.from("leads").update({ stage }).eq("id", leadId);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage } : l));
  }

  async function deleteLead(leadId: string) {
    await supabase.from("leads").delete().eq("id", leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setDeleteConfirm(null);
  }

  async function convertToClient(lead: Lead) {
    if (!businessId) return;
    setConverting(lead.id);
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        business_id: businessId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        notes: lead.notes,
      })
      .select("id")
      .single();
    if (!error && client) {
      await supabase.from("leads").update({ stage: "won" }).eq("id", lead.id);
      router.push(`/clients/${client.id}`);
    }
    setConverting(null);
  }

  const filtered = stageFilter === "all" ? leads : leads.filter((l) => l.stage === stageFilter);

  const stageCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  }, {});

  const totalPipeline = leads
    .filter((l) => l.stage !== "lost")
    .reduce((s, l) => s + (l.estimated_value ?? 0), 0);

  const wonValue = leads
    .filter((l) => l.stage === "won")
    .reduce((s, l) => s + (l.estimated_value ?? 0), 0);

  return (
    <div className="flex flex-col gap-0 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-8 pt-4 pb-2">
        <div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">Leads</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {leads.length} prospect{leads.length !== 1 ? "s" : ""} · ${totalPipeline.toFixed(0)} pipeline
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-bold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add Lead
        </button>
      </div>

      {/* Pipeline summary */}
      {leads.length > 0 && (
        <div className="mx-4 lg:mx-8 mb-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="rounded-2xl bg-card border border-border p-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pipeline</p>
            <p className="text-lg font-extrabold text-foreground mt-0.5">${totalPipeline.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">{leads.filter(l => l.stage !== "lost").length} active leads</p>
          </div>
          <div className="rounded-2xl bg-card border border-border p-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Won</p>
            <p className="text-lg font-extrabold text-green-600 mt-0.5">${wonValue.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">{stageCounts["won"] ?? 0} converted</p>
          </div>
        </div>
      )}

      {/* Stage filter */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setStageFilter("all")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            stageFilter === "all"
              ? "bg-primary text-white border-primary"
              : "bg-card text-muted-foreground border-border"
          }`}
        >
          All ({leads.length})
        </button>
        {STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStageFilter(s.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              stageFilter === s.value
                ? "text-white border-transparent"
                : "bg-card text-muted-foreground border-border"
            }`}
            style={stageFilter === s.value ? { backgroundColor: s.color, borderColor: s.color } : {}}
          >
            {s.label} ({stageCounts[s.value] ?? 0})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading leads…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 px-8 text-center">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/30" style={{ fontVariationSettings: "'FILL' 1" }}>
            person_search
          </span>
          <p className="font-bold text-foreground">
            {stageFilter === "all" ? "No leads yet" : `No ${stageFilter} leads`}
          </p>
          <p className="text-xs text-muted-foreground">
            {stageFilter === "all" ? "Add your first prospect to start tracking your pipeline." : "Try a different stage filter."}
          </p>
          {stageFilter === "all" && (
            <button
              onClick={openAdd}
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold"
            >
              Add Lead
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 px-4 lg:px-8">
          {filtered.map((lead) => {
            const stage = STAGES.find((s) => s.value === lead.stage)!;
            const apptDate = lead.preferred_date
              ? new Date(lead.preferred_date + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })
              : null;
            return (
              <div key={lead.id}
                className="rounded-2xl bg-card border border-border overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => router.push(`/leads/${lead.id}`)}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-foreground">{lead.name}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${stage.bg}`}
                          style={{ color: stage.color }}
                        >
                          <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {stage.icon}
                          </span>
                          {stage.label}
                        </span>
                        {lead.source && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {lead.source}
                          </span>
                        )}
                        {apptDate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">
                            <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
                            Appt: {apptDate}
                          </span>
                        )}
                      </div>
                      {lead.estimated_value != null && lead.estimated_value > 0 && (
                        <p className="text-base font-extrabold text-primary mt-0.5">
                          ${lead.estimated_value.toFixed(0)}
                          <span className="text-xs font-medium text-muted-foreground ml-1">est. value</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(lead); }}
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>

                  {(lead.phone || lead.email || lead.address) && (
                    <div className="flex flex-col gap-1 mb-3">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <span className="material-symbols-outlined text-[13px]">phone</span>
                          {lead.phone}
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground truncate">
                          <span className="material-symbols-outlined text-[13px]">mail</span>
                          {lead.email}
                        </a>
                      )}
                      {lead.address && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="material-symbols-outlined text-[13px]">location_on</span>
                          {lead.address}
                        </p>
                      )}
                    </div>
                  )}

                  {lead.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 mb-3 line-clamp-2">
                      {lead.notes}
                    </p>
                  )}

                  {/* Stage advancement */}
                  <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {lead.stage !== "won" && lead.stage !== "lost" && (
                      <>
                        {lead.stage === "new" && (
                          <button
                            onClick={() => updateStage(lead.id, "contacted")}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold border border-primary/20 active:scale-95 transition-transform"
                          >
                            <span className="material-symbols-outlined text-[13px]">phone_in_talk</span>
                            Mark Contacted
                          </button>
                        )}
                        {lead.stage === "contacted" && (
                          <button
                            onClick={() => updateStage(lead.id, "quoted")}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 text-xs font-bold border border-amber-500/20 active:scale-95 transition-transform"
                          >
                            <span className="material-symbols-outlined text-[13px]">request_quote</span>
                            Send Quote
                          </button>
                        )}
                        {lead.stage === "quoted" && (
                          <button
                            onClick={() => convertToClient(lead)}
                            disabled={!!converting}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-green-600/10 text-green-600 text-xs font-bold border border-green-600/20 active:scale-95 transition-transform disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[13px]">person_check</span>
                            {converting === lead.id ? "Converting…" : "Convert to Client"}
                          </button>
                        )}
                        <button
                          onClick={() => updateStage(lead.id, "lost")}
                          className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold border border-red-500/20 active:scale-95 transition-transform"
                        >
                          Lost
                        </button>
                      </>
                    )}
                    {lead.stage === "won" && (
                      <button
                        onClick={() => convertToClient(lead)}
                        disabled={!!converting}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-green-600/10 text-green-600 text-xs font-bold border border-green-600/20 active:scale-95 transition-transform disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[13px]">person_check</span>
                        {converting === lead.id ? "Converting…" : "Convert to Client"}
                      </button>
                    )}
                    {lead.stage === "lost" && (
                      <button
                        onClick={() => updateStage(lead.id, "new")}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-bold border border-border active:scale-95 transition-transform"
                      >
                        <span className="material-symbols-outlined text-[13px]">refresh</span>
                        Reopen
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(lead.id)}
                      className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium border border-border active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* Delete confirm */}
                {deleteConfirm === lead.id && (
                  <div className="border-t border-border px-4 py-3 bg-red-50 dark:bg-red-950/20 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs font-bold text-red-600">Delete this lead?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-bold border border-border"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-lg bg-card rounded-t-3xl border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/50">
              <h2 className="font-extrabold text-base text-foreground">
                {editLead ? "Edit Lead" : "Add Lead"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[70vh] px-5 py-4 flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Name *
                </label>
                <input
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  placeholder="Full name or business name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Phone</label>
                  <input
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                    placeholder="(555) 000-0000"
                    type="tel"
                    value={form.phone ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Email</label>
                  <input
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                    placeholder="email@example.com"
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Address</label>
                <input
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  placeholder="123 Main St, City, State"
                  value={form.address ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>

              {/* Stage + Source */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Stage</label>
                  <select
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                    value={form.stage}
                    onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as LeadStage }))}
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Source</label>
                  <select
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                    value={form.source ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value || null }))}
                  >
                    <option value="">Select source…</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Estimated value */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Estimated Value ($)
                </label>
                <input
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimated_value ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value ? parseFloat(e.target.value) : null }))}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Notes</label>
                <textarea
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
                  rows={3}
                  placeholder="Property details, preferences, follow-up reminders…"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border/50 flex gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-foreground bg-muted/40"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
              >
                {saving ? "Saving…" : editLead ? "Save Changes" : "Add Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
