"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";

type CanvassingLead = {
  id: string;
  name: string;
  phone: string | null;
  phone_alt: string | null;
  email: string | null;
  address: string | null;
  stage: LeadStage;
  source: string | null;
  rapport_notes: string | null;
  service_notes: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  created_at: string;
};

const STAGES: { value: LeadStage; label: string; color: string; bg: string; icon: string }[] = [
  { value: "new",       label: "New",       color: "#6b7280", bg: "bg-gray-500/10",  icon: "person_add"    },
  { value: "contacted", label: "Contacted", color: "#007AFF", bg: "bg-primary/10",  icon: "phone_in_talk" },
  { value: "quoted",    label: "Quoted",    color: "#f59e0b", bg: "bg-amber-500/10", icon: "request_quote" },
  { value: "won",       label: "Won",       color: "#16a34a", bg: "bg-green-600/10", icon: "check_circle"  },
  { value: "lost",      label: "Lost",      color: "#dc2626", bg: "bg-red-600/10",   icon: "cancel"        },
];

export default function CanvassingLeadsClient({
  initialLeads,
  initialBusinessId,
}: {
  initialLeads: CanvassingLead[];
  initialBusinessId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [leads, setLeads] = useState<CanvassingLead[]>(initialLeads);
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [businessId] = useState<string | null>(initialBusinessId);
  const [converting, setConverting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function updateStage(leadId: string, stage: LeadStage) {
    await supabase.from("leads").update({ stage }).eq("id", leadId);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage } : l));
  }

  async function convertToClient(lead: CanvassingLead) {
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
      router.push(`/clients/${(client as { id: string }).id}`);
    }
    setConverting(null);
  }

  async function deleteLead(leadId: string) {
    await supabase.from("leads").delete().eq("id", leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setDeleteConfirm(null);
  }

  const filtered = stageFilter === "all" ? leads : leads.filter((l) => l.stage === stageFilter);

  const stageCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-0 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-8 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <Link href="/canvassing"
            className="flex size-8 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">Canvassing Bookings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {leads.length} lead{leads.length !== 1 ? "s" : ""} captured from the map
            </p>
          </div>
        </div>
        <Link href="/canvassing"
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-bold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-[16px]">map</span>
          Open Map
        </Link>
      </div>

      {/* Summary cards */}
      {leads.length > 0 && (
        <div className="mx-4 lg:mx-8 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total",     count: leads.length,                             color: "text-foreground"   },
            { label: "New",       count: stageCounts["new"] ?? 0,                  color: "text-muted-foreground" },
            { label: "Contacted", count: stageCounts["contacted"] ?? 0,            color: "text-primary"      },
            { label: "Won",       count: stageCounts["won"] ?? 0,                  color: "text-green-600"    },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-extrabold mt-0.5 ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stage filter */}
      <div className="flex gap-2 px-4 lg:px-8 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setStageFilter("all")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            stageFilter === "all" ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border"
          }`}
        >
          All ({leads.length})
        </button>
        {STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStageFilter(s.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              stageFilter === s.value ? "text-white border-transparent" : "bg-card text-muted-foreground border-border"
            }`}
            style={stageFilter === s.value ? { backgroundColor: s.color, borderColor: s.color } : {}}
          >
            {s.label} ({stageCounts[s.value] ?? 0})
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 px-8 text-center">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/30" style={{ fontVariationSettings: "'FILL' 1" }}>
            person_pin
          </span>
          <p className="font-bold text-foreground">
            {stageFilter === "all" ? "No canvassing bookings yet" : `No ${stageFilter} bookings`}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {stageFilter === "all"
              ? "When you or your team tap Book Now on the canvassing map and fill out the form, the customer shows up here."
              : "Try a different stage filter."}
          </p>
          {stageFilter === "all" && (
            <Link href="/canvassing"
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold">
              Go to Map
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 px-4 lg:px-8">
          {filtered.map((lead) => {
            const stage = STAGES.find((s) => s.value === lead.stage)!;
            const apptDate = lead.preferred_date
              ? new Date(lead.preferred_date + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })
              : null;
            const createdDate = new Date(lead.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

            return (
              <div key={lead.id}
                className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="p-4">
                  {/* Name + stage */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-foreground">{lead.name}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${stage.bg}`}
                          style={{ color: stage.color }}>
                          <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {stage.icon}
                          </span>
                          {stage.label}
                        </span>
                        {apptDate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">
                            <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
                            {apptDate}{lead.preferred_time ? ` · ${lead.preferred_time}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Booked {createdDate}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </button>
                  </div>

                  {/* Contact info */}
                  <div className="flex flex-col gap-1 mb-3">
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                        <span className="material-symbols-outlined text-[13px]">phone</span>
                        {lead.phone}{lead.phone_alt ? ` · ${lead.phone_alt}` : ""}
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

                  {/* Notes */}
                  {lead.service_notes && (
                    <div className="mb-2 rounded-xl bg-muted/40 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Service Notes</p>
                      <p className="text-xs text-foreground/80 line-clamp-2">{lead.service_notes}</p>
                    </div>
                  )}
                  {lead.rapport_notes && (
                    <div className="mb-3 rounded-xl bg-muted/40 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Rapport Notes</p>
                      <p className="text-xs text-foreground/80 line-clamp-2">{lead.rapport_notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {lead.stage !== "won" && lead.stage !== "lost" && (
                      <>
                        {lead.stage === "new" && (
                          <button
                            onClick={() => updateStage(lead.id, "contacted")}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold border border-primary/20 active:scale-95 transition-transform">
                            <span className="material-symbols-outlined text-[13px]">phone_in_talk</span>
                            Mark Contacted
                          </button>
                        )}
                        {lead.stage === "contacted" && (
                          <button
                            onClick={() => updateStage(lead.id, "quoted")}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 text-xs font-bold border border-amber-500/20 active:scale-95 transition-transform">
                            <span className="material-symbols-outlined text-[13px]">request_quote</span>
                            Send Quote
                          </button>
                        )}
                        {lead.stage === "quoted" && (
                          <button
                            onClick={() => convertToClient(lead)}
                            disabled={!!converting}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-green-600/10 text-green-600 text-xs font-bold border border-green-600/20 active:scale-95 transition-transform disabled:opacity-50">
                            <span className="material-symbols-outlined text-[13px]">person_check</span>
                            {converting === lead.id ? "Converting…" : "Convert to Client"}
                          </button>
                        )}
                        <button
                          onClick={() => updateStage(lead.id, "lost")}
                          className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold border border-red-500/20 active:scale-95 transition-transform">
                          Lost
                        </button>
                      </>
                    )}
                    {lead.stage === "won" && (
                      <button
                        onClick={() => convertToClient(lead)}
                        disabled={!!converting}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-green-600/10 text-green-600 text-xs font-bold border border-green-600/20 active:scale-95 transition-transform disabled:opacity-50">
                        <span className="material-symbols-outlined text-[13px]">person_check</span>
                        {converting === lead.id ? "Converting…" : "Convert to Client"}
                      </button>
                    )}
                    {lead.stage === "lost" && (
                      <button
                        onClick={() => updateStage(lead.id, "new")}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-bold border border-border active:scale-95 transition-transform">
                        <span className="material-symbols-outlined text-[13px]">refresh</span>
                        Reopen
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(lead.id)}
                      className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium border border-border active:scale-95 transition-transform">
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* Delete confirm */}
                {deleteConfirm === lead.id && (
                  <div className="border-t border-border px-4 py-3 bg-red-50 dark:bg-red-950/20 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-red-600">Delete this booking?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-bold border border-border">
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold">
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
    </div>
  );
}
