"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/currency";

export type MemberRow = { id: string; name: string | null };
export type LaborRow = {
  team_member_id: string | null;
  amount: number | null;
  status: "pending" | "owed" | "paid";
};
export type CommissionRow = {
  member_id: string | null;
  amount: number | null;
  status: "pending" | "owed" | "paid";
};
export type BatchRow = {
  id: string;
  member_id: string;
  labor_total: number | null;
  commission_total: number | null;
  total_amount: number | null;
  method: string | null;
  created_at: string;
  team_members: { name: string } | null;
};

type MemberRollup = {
  id: string;
  name: string;
  owedLabor: number;
  owedCommission: number;
  owedTotal: number;
  pendingTotal: number;
};

const PAY_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
] as const;

type PayMethod = (typeof PAY_METHODS)[number]["value"];

function methodLabel(method: string | null) {
  if (!method) return "—";
  const found = PAY_METHODS.find((m) => m.value === method);
  return found ? found.label : method.charAt(0).toUpperCase() + method.slice(1);
}

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function PayoutsClient({
  businessId,
  currency,
  initialMembers,
  initialLabor,
  initialCommission,
  initialBatches,
}: {
  businessId: string;
  currency: string;
  initialMembers: MemberRow[];
  initialLabor: LaborRow[];
  initialCommission: CommissionRow[];
  initialBatches: BatchRow[];
}) {
  const router = useRouter();
  const fmt = useCallback((n: number) => formatCurrency(n, currency), [currency]);

  const [members] = useState<MemberRow[]>(initialMembers);
  const [labor, setLabor] = useState<LaborRow[]>(initialLabor);
  const [commission, setCommission] = useState<CommissionRow[]>(initialCommission);
  const [batches, setBatches] = useState<BatchRow[]>(initialBatches);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null); // member row whose picker is open
  const [method, setMethod] = useState<PayMethod>("cash");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showZero, setShowZero] = useState(false);

  // Per-member roll-up of owed + pending across labor and commission.
  const rollups = useMemo((): MemberRollup[] => {
    const map = new Map<string, MemberRollup>();
    for (const m of members) {
      map.set(m.id, {
        id: m.id,
        name: m.name?.trim() || "Unnamed",
        owedLabor: 0,
        owedCommission: 0,
        owedTotal: 0,
        pendingTotal: 0,
      });
    }
    for (const l of labor) {
      if (!l.team_member_id) continue;
      const r = map.get(l.team_member_id);
      if (!r) continue;
      const amt = Number(l.amount ?? 0);
      if (l.status === "owed") r.owedLabor += amt;
      else if (l.status === "pending") r.pendingTotal += amt;
    }
    for (const c of commission) {
      if (!c.member_id) continue;
      const r = map.get(c.member_id);
      if (!r) continue;
      const amt = Number(c.amount ?? 0);
      if (c.status === "owed") r.owedCommission += amt;
      else if (c.status === "pending") r.pendingTotal += amt;
    }
    for (const r of map.values()) r.owedTotal = r.owedLabor + r.owedCommission;
    return Array.from(map.values()).sort((a, b) => b.owedTotal - a.owedTotal);
  }, [members, labor, commission]);

  const owedRollups = rollups.filter((r) => r.owedTotal > 0.005);
  const zeroRollups = rollups.filter((r) => r.owedTotal <= 0.005);

  const summary = useMemo(() => {
    const totalOwed = rollups.reduce((s, r) => s + r.owedTotal, 0);
    const totalPending = rollups.reduce((s, r) => s + r.pendingTotal, 0);
    const start = monthStart();
    const paidThisMonth = batches
      .filter((b) => new Date(b.created_at) >= start)
      .reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
    return { totalOwed, totalPending, paidThisMonth };
  }, [rollups, batches]);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [laborRes, commissionRes, batchesRes] = await Promise.all([
      supabase
        .from("job_payouts")
        .select("team_member_id, amount, status")
        .eq("business_id", businessId)
        .in("status", ["pending", "owed"]),
      supabase
        .from("commission_entries")
        .select("member_id, amount, status")
        .eq("business_id", businessId)
        .not("member_id", "is", null)
        .in("status", ["pending", "owed"]),
      supabase
        .from("payout_batches")
        .select(
          "id, member_id, labor_total, commission_total, total_amount, method, created_at, team_members(name)"
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setLabor((laborRes.data as unknown as LaborRow[]) ?? []);
    setCommission((commissionRes.data as unknown as CommissionRow[]) ?? []);
    setBatches((batchesRes.data as unknown as BatchRow[]) ?? []);
  }, [businessId]);

  function openPicker(memberId: string) {
    setPayingId(memberId);
    setMethod("cash");
    setNote("");
  }

  async function settle(member: MemberRollup) {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("settle_member_payout", {
      p_business_id: businessId,
      p_member_id: member.id,
      p_method: method,
      p_notes: note.trim() || null,
    });
    setSubmitting(false);

    const result = data as
      | { success?: boolean; total?: number; error?: string }
      | null;

    if (error || !result || result.error || !result.success) {
      toast.error(result?.error || "Couldn't record this payout — try again.");
      return;
    }

    setPayingId(null);
    setExpandedId(null);
    await reload();
    toast.success(
      `Paid ${member.name} ${fmt(Number(result.total ?? member.owedTotal))}`
    );
  }

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
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Payouts</h1>
          <p className="text-xs text-muted-foreground">
            Settle everyone you owe — labor and commission in one payout
          </p>
        </div>
      </div>

      {/* Summary totals */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Owed now</span>
          <span className="text-lg font-extrabold text-blue-600">{fmt(summary.totalOwed)}</span>
        </Card>
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending</span>
          <span className="text-lg font-extrabold text-amber-600">{fmt(summary.totalPending)}</span>
        </Card>
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paid this mo.</span>
          <span className="text-lg font-extrabold text-green-600">{fmt(summary.paidThisMonth)}</span>
        </Card>
      </div>

      {/* Who's owed */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Owed now</h3>

        {owedRollups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center rounded-2xl border border-dashed border-border">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">payments</span>
            <p className="text-sm font-semibold text-muted-foreground">Everyone&apos;s paid up</p>
            <p className="text-xs text-muted-foreground/60">
              Owed amounts appear here once a customer pays for the job.
            </p>
          </div>
        ) : (
          owedRollups.map((r) => {
            const isExpanded = expandedId === r.id;
            const isPaying = payingId === r.id;
            return (
              <Card key={r.id} className="rounded-2xl border-border shadow-sm overflow-hidden">
                {/* Row header — tap to expand */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : r.id);
                    if (isPaying) setPayingId(null);
                  }}
                  className="w-full grid grid-cols-[1fr_auto] gap-3 px-4 py-3.5 items-center text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">{r.name}</span>
                    {r.pendingTotal > 0.005 && (
                      <span className="text-xs text-muted-foreground">
                        {fmt(r.pendingTotal)} pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-extrabold text-blue-600">{fmt(r.owedTotal)}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">owed</span>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-muted-foreground/50">
                      {isExpanded ? "expand_less" : "expand_more"}
                    </span>
                  </div>
                </button>

                {/* Expanded breakdown + pay flow */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-border/40">
                    <div className="flex flex-col gap-1.5 pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Labor</span>
                        <span className="font-semibold text-foreground">{fmt(r.owedLabor)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Commission</span>
                        <span className="font-semibold text-foreground">{fmt(r.owedCommission)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-1.5 border-t border-border/40">
                        <span className="font-bold text-foreground">Total owed</span>
                        <span className="font-extrabold text-blue-600">{fmt(r.owedTotal)}</span>
                      </div>
                    </div>

                    {!isPaying ? (
                      <button
                        onClick={() => openPicker(r.id)}
                        className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
                      >
                        Pay {r.name} {fmt(r.owedTotal)}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Payment method
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {PAY_METHODS.map((m) => (
                              <button
                                key={m.value}
                                onClick={() => setMethod(m.value)}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                  method === m.value
                                    ? "bg-primary text-white shadow-sm"
                                    : "bg-card text-foreground border border-border hover:bg-muted/60"
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Note (optional)
                          </label>
                          <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. Venmo @handle, week of Jul 14"
                            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPayingId(null)}
                            disabled={submitting}
                            className="flex-1 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm font-bold hover:bg-muted/60 disabled:opacity-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => settle(r)}
                            disabled={submitting}
                            className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                          >
                            {submitting ? "Recording…" : `Confirm ${fmt(r.owedTotal)}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}

        {/* Nothing-owed members */}
        {zeroRollups.length > 0 && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowZero((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
            >
              {showZero ? "Hide" : "Show"} {zeroRollups.length} team member
              {zeroRollups.length !== 1 ? "s" : ""} with nothing owed
            </button>
            {showZero && (
              <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
                {zeroRollups.map((r, i) => (
                  <div
                    key={r.id}
                    className={`grid grid-cols-[1fr_auto] gap-3 px-4 py-3 items-center ${
                      i < zeroRollups.length - 1 ? "border-b border-border/40" : ""
                    }`}
                  >
                    <span className="text-sm font-medium text-muted-foreground truncate">{r.name}</span>
                    <span className="text-xs text-muted-foreground/60">
                      {r.pendingTotal > 0.005 ? `${fmt(r.pendingTotal)} pending` : "$0"}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Recent payouts */}
      {batches.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent payouts</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            {batches.slice(0, 15).map((b, i) => (
              <div
                key={b.id}
                className={`grid grid-cols-[1fr_auto] gap-3 px-4 py-3 items-center ${
                  i < Math.min(batches.length, 15) - 1 ? "border-b border-border/40" : ""
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-foreground truncate">
                    {b.team_members?.name ?? "Team member"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {methodLabel(b.method)} ·{" "}
                    {new Date(b.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
                <span className="text-sm font-extrabold text-foreground">
                  {fmt(Number(b.total_amount ?? 0))}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        &quot;Owed&quot; means the customer has paid. &quot;Pending&quot; hasn&apos;t been collected yet, so
        it isn&apos;t ready to pay out. Owner-sold commission is your own and never appears here.
      </p>
    </div>
  );
}
