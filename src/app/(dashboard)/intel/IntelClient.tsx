"use client";

import { useState } from "react";

export type IntelRow = {
  id: string;
  competitor_name: string;
  observation_type: string;
  price_amount: number | null;
  notes: string | null;
  created_at: string;
  jobs: { clients: { name: string; address: string | null } | null } | null;
  team_members: { name: string } | null;
};

const OBS_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  truck_spotted:     { label: "Truck spotted",      icon: "local_shipping", color: "#007AFF", bg: "bg-primary/10" },
  yard_sign:         { label: "Yard sign",           icon: "signpost",       color: "#FF9500", bg: "bg-[#FF9500]/10" },
  customer_mentioned:{ label: "Customer mentioned",  icon: "chat_bubble",    color: "#AF52DE", bg: "bg-[#AF52DE]/10" },
  price_info:        { label: "Price info",          icon: "sell",           color: "#34C759", bg: "bg-[#34C759]/10" },
  quality_note:      { label: "Quality note",        icon: "star",           color: "#FF2D55", bg: "bg-[#FF2D55]/10" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function IntelClient({ initialRows }: { initialRows: IntelRow[] }) {
  const [rows] = useState<IntelRow[]>(initialRows);
  const [filterCompetitor, setFilterCompetitor] = useState("all");

  const competitors = Array.from(new Set(rows.map((r) => r.competitor_name))).sort();

  const filtered = filterCompetitor === "all"
    ? rows
    : rows.filter((r) => r.competitor_name === filterCompetitor);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Field Intelligence</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Competitor Intel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What your crew spots in the field — competitor trucks, yard signs, pricing, and more.
        </p>
      </div>

      {/* Filter chips */}
      {competitors.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCompetitor("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              filterCompetitor === "all"
                ? "bg-primary text-white border-primary"
                : "border-border text-muted-foreground bg-card hover:bg-muted"
            }`}
          >
            All ({rows.length})
          </button>
          {competitors.map((name) => {
            const count = rows.filter((r) => r.competitor_name === name).length;
            return (
              <button
                key={name}
                onClick={() => setFilterCompetitor(name)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  filterCompetitor === name
                    ? "bg-primary text-white border-primary"
                    : "border-border text-foreground bg-card hover:bg-muted"
                }`}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="material-symbols-outlined text-[56px] text-muted-foreground/20">visibility_off</span>
          <p className="text-sm font-semibold text-muted-foreground">No intel yet</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            Your crew can log competitor sightings from the job detail screen in the employee app.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((row) => {
            const meta = OBS_META[row.observation_type] ?? OBS_META.truck_spotted;
            return (
              <div key={row.id} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}
                    >
                      {meta.icon}
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-sm text-foreground truncate">{row.competitor_name}</span>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{formatDate(row.created_at)}</span>
                    </div>
                    <span
                      className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg}`}
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {row.price_amount != null && (
                      <p className="text-sm font-bold text-foreground mt-1">
                        Quoted: ${row.price_amount.toFixed(2)}
                      </p>
                    )}
                    {row.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{row.notes}</p>
                    )}
                  </div>
                </div>
                <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50 flex items-center gap-3 flex-wrap">
                  {row.team_members && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[13px] text-muted-foreground">badge</span>
                      <span className="text-xs text-muted-foreground">{row.team_members.name}</span>
                    </div>
                  )}
                  {row.jobs?.clients && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[13px] text-muted-foreground">location_on</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {row.jobs.clients.address ?? row.jobs.clients.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
