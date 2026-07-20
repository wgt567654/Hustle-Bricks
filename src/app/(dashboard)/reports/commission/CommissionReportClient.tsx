"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export type CommissionEntry = {
  id: string;
  member_id: string | null;
  sold_by_owner: boolean;
  lead_source: string | null;
  rate: number;
  job_total: number | null;
  amount: number;
  status: "pending" | "owed" | "paid";
  owed_at: string | null;
  paid_at: string | null;
  created_at: string;
  team_members: { name: string } | null;
  jobs: { id: string; completed_at: string | null; clients: { name: string } | null } | null;
};

type SellerTotals = {
  key: string;
  name: string;
  isOwner: boolean;
  entries: number;
  revenue: number;
  amount: number;
  owed: number;
};

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function leadSourceLabel(source: string | null) {
  if (source === "self_generated") return "Self-generated";
  if (source === "website") return "Website";
  return "House";
}

const STATUS_STYLES: Record<CommissionEntry["status"], string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  owed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  paid: "bg-green-500/10 text-green-600 dark:text-green-400",
};

export default function CommissionReportClient({
  initialEntries,
  selfGenRate,
  houseRate,
}: {
  initialEntries: CommissionEntry[];
  selfGenRate: number;
  houseRate: number;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<CommissionEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [range, setRange] = useState<"week" | "month" | "ytd" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Skip the first effect run — the server already provided the initial
  // (month) dataset, so we only re-fetch when the date range changes.
  const isFirstRun = useRef(true);

  const now = new Date();

  const { startDate, endDate } = useMemo(() => {
    if (range === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    if (range === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    if (range === "ytd") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: start, endDate: now };
    }
    const start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = customEnd ? new Date(customEnd + "T23:59:59") : new Date();
    return { startDate: start, endDate: end };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (!biz) return;

      const { data: entryData } = await supabase
        .from("commission_entries")
        .select(
          "id, member_id, sold_by_owner, lead_source, rate, job_total, amount, status, owed_at, paid_at, created_at, team_members(name), jobs(id, completed_at, clients(name))"
        )
        .eq("business_id", biz.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      setEntries((entryData as unknown as CommissionEntry[]) ?? []);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  async function markPaid(entryId: string) {
    setMarkingId(entryId);
    const supabase = createClient();
    const paidAt = new Date().toISOString();
    const { error } = await supabase
      .from("commission_entries")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", entryId)
      .eq("status", "owed");
    setMarkingId(null);
    if (error) {
      toast.error("Couldn't mark this commission paid — try again.");
      return;
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, status: "paid" as const, paid_at: paidAt } : e))
    );
    toast.success("Commission marked paid");
  }

  function sellerName(e: CommissionEntry) {
    if (e.sold_by_owner || !e.member_id) return "Owner";
    return e.team_members?.name ?? "Unknown";
  }

  const sellerTotals = useMemo((): SellerTotals[] => {
    const map: Record<string, SellerTotals> = {};
    for (const e of entries) {
      const isOwner = e.sold_by_owner || !e.member_id;
      const key = isOwner ? "__owner__" : e.member_id!;
      if (!map[key]) {
        map[key] = { key, name: sellerName(e), isOwner, entries: 0, revenue: 0, amount: 0, owed: 0 };
      }
      map[key].entries++;
      map[key].revenue += e.job_total ?? 0;
      map[key].amount += e.amount ?? 0;
      if (e.status === "owed") map[key].owed += e.amount ?? 0;
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [entries]);

  const totals = useMemo(() => ({
    revenue: entries.reduce((s, e) => s + (e.job_total ?? 0), 0),
    pending: entries.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0),
    owed: entries.filter((e) => e.status === "owed").reduce((s, e) => s + e.amount, 0),
    paid: entries.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0),
  }), [entries]);

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    if (range === "ytd") return `Jan 1 – ${fmt(now)}`;
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, startDate, endDate]);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-2xl mx-auto pb-32 lg:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/analytics")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex flex-col flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Commissions</h1>
          <p className="text-xs text-muted-foreground">
            {rangeLabel} · Self-gen {selfGenRate}% · House {houseRate}%
          </p>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex gap-2">
        {(["week", "month", "ytd", "custom"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              range === r
                ? "bg-primary text-white shadow-sm"
                : "bg-muted text-foreground border border-border hover:bg-muted/80"
            }`}
          >
            {r === "week" ? "Week" : r === "month" ? "Month" : r === "ytd" ? "YTD" : "Custom"}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
      )}

      {/* Summary totals */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending</span>
            <span className="text-lg font-extrabold text-amber-600">{fmt$(totals.pending)}</span>
          </Card>
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Owed</span>
            <span className="text-lg font-extrabold text-blue-600">{fmt$(totals.owed)}</span>
          </Card>
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paid</span>
            <span className="text-lg font-extrabold text-green-600">{fmt$(totals.paid)}</span>
          </Card>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center rounded-2xl border border-dashed border-border">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">emoji_events</span>
          <p className="text-sm font-semibold text-muted-foreground">No commission entries in this period</p>
          <p className="text-xs text-muted-foreground/60">Entries appear automatically when sold jobs are completed</p>
        </div>
      ) : (
        <>
          {/* Totals per seller */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">By Seller</h3>
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              {sellerTotals.map((s, i) => (
                <div
                  key={s.key}
                  className={`grid grid-cols-[1fr_auto] gap-3 px-4 py-3.5 items-center ${i < sellerTotals.length - 1 ? "border-b border-border/40" : ""}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">
                      {s.name}
                      {s.isOwner && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">no payout</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.entries} job{s.entries !== 1 ? "s" : ""} · {fmt$(s.revenue)} revenue
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-extrabold text-foreground">{fmt$(s.amount)}</span>
                    {s.owed > 0 && (
                      <span className="text-xs font-bold text-blue-600">{fmt$(s.owed)} owed</span>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Individual entries */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Entries</h3>
            {entries.map((e) => (
              <Card key={e.id} className="rounded-2xl border-border shadow-sm p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground flex-1 truncate">
                    {sellerName(e)}
                    {e.jobs?.clients?.name ? (
                      <span className="font-medium text-muted-foreground"> · {e.jobs.clients.name}</span>
                    ) : null}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLES[e.status]}`}>
                    {e.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{leadSourceLabel(e.lead_source)} lead</span>
                  <span>·</span>
                  <span>{Number(e.rate)}% of {fmt$(e.job_total ?? 0)}</span>
                  <span>·</span>
                  <span>{new Date(e.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-extrabold text-foreground">{fmt$(e.amount)}</span>
                  {e.status === "owed" && !e.sold_by_owner && (
                    <button
                      onClick={() => markPaid(e.id)}
                      disabled={markingId === e.id}
                      className="px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {markingId === e.id ? "Saving…" : "Mark paid"}
                    </button>
                  )}
                  {e.status === "paid" && e.paid_at && (
                    <span className="text-[11px] text-muted-foreground">
                      Paid {new Date(e.paid_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Per-rep override rates can be set in{" "}
            <button onClick={() => router.push("/team")} className="underline font-medium">Team settings</button>.
            Lead-source defaults live in{" "}
            <button onClick={() => router.push("/settings")} className="underline font-medium">Settings</button>.
          </p>
        </>
      )}
    </div>
  );
}
