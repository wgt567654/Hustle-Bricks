"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type TeamMember = { id: string; name: string; home_address: string | null };

type MileageRecord = {
  id: string;
  date: string;
  total_miles: number;
  rate_per_mile: number;
  reimbursement: number;
  route_snapshot: { origin: string; stops: string[] } | null;
};

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function MileageReportPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [records, setRecords] = useState<MileageRecord[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calcDate, setCalcDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (!biz) return;

      const { data } = await supabase
        .from("team_members")
        .select("id, name, home_address")
        .eq("business_id", biz.id)
        .eq("is_active", true)
        .order("name");
      setMembers((data ?? []) as TeamMember[]);
      if (data?.[0]) setSelectedId(data[0].id);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    async function fetchRecords() {
      const supabase = createClient();
      const { data } = await supabase
        .from("daily_mileage")
        .select("id, date, total_miles, rate_per_mile, reimbursement, route_snapshot")
        .eq("employee_id", selectedId)
        .order("date", { ascending: false })
        .limit(60);
      setRecords((data ?? []) as MileageRecord[]);
    }
    fetchRecords();
  }, [selectedId]);

  async function calculate() {
    setCalculating(true);
    setCalcError(null);
    const res = await fetch("/api/mileage/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: selectedId, date: calcDate }),
    });
    const json = await res.json() as { record?: MileageRecord; error?: string };
    if (!res.ok) {
      setCalcError(json.error ?? "Calculation failed");
    } else if (json.record) {
      setRecords((prev) => {
        const filtered = prev.filter((r) => r.date !== json.record!.date);
        return [json.record!, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
      });
    }
    setCalculating(false);
  }

  const selected = members.find((m) => m.id === selectedId);
  const totalReimbursement = records.reduce((sum, r) => sum + (r.reimbursement ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-2xl mx-auto pb-32 lg:pb-8">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Mileage Reimbursement</h1>
        <p className="text-xs text-muted-foreground">Calculate driving distance for each employee&apos;s job route.</p>
      </div>

      {/* Employee selector */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Employee</h3>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border/50">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full p-4 flex items-center gap-3 transition-colors ${selectedId === m.id ? "bg-primary/5" : "hover:bg-muted/50"}`}
            >
              <div className={`size-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${selectedId === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-sm text-foreground">{m.name}</span>
                <span className="text-xs text-muted-foreground">
                  {m.home_address ?? "No home address on file"}
                </span>
              </div>
              {selectedId === m.id && (
                <span className="material-symbols-outlined text-primary ml-auto">check_circle</span>
              )}
            </button>
          ))}
        </Card>
      </section>

      {/* Calculate for a date */}
      {selected && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Calculate Route</h3>
          <Card className="rounded-2xl border-border shadow-sm p-4 flex flex-col gap-3">
            {!selected.home_address && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span className="text-xs font-medium">This employee hasn&apos;t set a home address yet.</span>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={calcDate}
                onChange={(e) => setCalcDate(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={calculate}
                disabled={calculating || !selected.home_address}
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {calculating ? "Calculating…" : "Calculate"}
              </button>
            </div>
            {calcError && (
              <p className="text-xs text-red-500 font-medium">{calcError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Calculates home → job addresses in schedule order → home using Google Maps.
            </p>
          </Card>
        </section>
      )}

      {/* History */}
      {records.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">History</h3>
            <span className="text-xs font-bold text-foreground">Total: {fmt$(totalReimbursement)}</span>
          </div>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border/50">
            {records.map((r) => (
              <div key={r.id} className="flex flex-col">
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">directions_car</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-sm text-foreground">
                      {new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.total_miles} miles · ${r.rate_per_mile}/mi</span>
                  </div>
                  <span className="font-bold text-sm text-green-600 ml-auto">{fmt$(r.reimbursement)}</span>
                  <span className="material-symbols-outlined text-muted-foreground text-[18px]">
                    {expanded === r.id ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {expanded === r.id && r.route_snapshot && (
                  <div className="px-4 pb-4 flex flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">home</span>
                      <span className="text-xs text-muted-foreground">{r.route_snapshot.origin}</span>
                    </div>
                    {r.route_snapshot.stops.map((stop, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[16px] text-muted-foreground mt-0.5">location_on</span>
                        <span className="text-xs text-muted-foreground">{stop}</span>
                      </div>
                    ))}
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">home</span>
                      <span className="text-xs text-muted-foreground">{r.route_snapshot.origin}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}

      {selected && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">route</span>
          <p className="text-sm text-muted-foreground">No mileage records yet for {selected.name}.</p>
          <p className="text-xs text-muted-foreground">Pick a date above and hit Calculate.</p>
        </div>
      )}
    </div>
  );
}
