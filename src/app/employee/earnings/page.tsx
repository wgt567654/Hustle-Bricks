"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/employee-membership-client";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatCurrencyRounded } from "@/lib/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayStatus = "pending" | "owed" | "paid";

type LaborRow = {
  id: string;
  job_id: string | null;
  pay_type: "hourly" | "percent" | "flat" | "custom";
  rate: number | null;
  minutes: number | null;
  amount: number;
  status: PayStatus;
  paid_at: string | null;
  method: string | null;
  jobs: { scheduled_at: string | null; job_line_items: { description: string }[] } | null;
};

type CommissionRow = {
  id: string;
  job_id: string | null;
  lead_source: string | null;
  rate: number;
  amount: number;
  status: PayStatus;
  paid_at: string | null;
  jobs: { scheduled_at: string | null; clients: { name: string } | null } | null;
};

type BatchRow = {
  id: string;
  labor_total: number;
  commission_total: number;
  total_amount: number;
  method: string | null;
  created_at: string;
};

// A unified row for the combined chronological earnings list.
type EarningRow = {
  id: string;
  kind: "labor" | "commission";
  name: string;
  ts: number; // sort key (ms)
  dateStr: string | null;
  basis: string;
  amount: number;
  status: PayStatus;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtHrs(hrs: number): string {
  const rounded = Math.round(hrs * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} hr${rounded === 1 ? "" : "s"}`;
}

// Basis line for a labor payout — the "how this was calculated" text.
// Transparency rule: show the basis, never the job's total price / margin.
function laborBasis(p: LaborRow): string {
  if (p.pay_type === "hourly") {
    const hrs = (p.minutes ?? 0) / 60;
    return `${fmtHrs(hrs)} @ ${formatCurrency(p.rate ?? 0)}/hr`;
  }
  if (p.pay_type === "percent") return `${Number(p.rate ?? 0)}%`;
  if (p.pay_type === "flat") return "Flat rate";
  return "Custom";
}

const STATUS_STYLES: Record<PayStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  owed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  paid: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const STATUS_LABEL: Record<PayStatus, string> = {
  pending: "Pending",
  owed: "Owed",
  paid: "Paid",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [hasMembership, setHasMembership] = useState(true);
  const [labor, setLabor] = useState<LaborRow[]>([]);
  const [commission, setCommission] = useState<CommissionRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasMembership(false);
        setLoading(false);
        return;
      }

      const { membership } = await getActiveMembership(supabase);
      if (!membership) {
        setHasMembership(false);
        setLoading(false);
        return;
      }

      const [{ data: laborData }, { data: commData }, { data: batchData }] = await Promise.all([
        supabase
          .from("job_payouts")
          .select(
            "id, job_id, pay_type, rate, minutes, amount, status, paid_at, method, jobs(scheduled_at, job_line_items(description))"
          )
          .eq("team_member_id", membership.member_id),
        supabase
          .from("commission_entries")
          .select("id, job_id, lead_source, rate, amount, status, paid_at, jobs(scheduled_at, clients(name))")
          .eq("member_id", membership.member_id),
        supabase
          .from("payout_batches")
          .select("id, labor_total, commission_total, total_amount, method, created_at")
          .eq("member_id", membership.member_id)
          .order("created_at", { ascending: false }),
      ]);

      setLabor((laborData as unknown as LaborRow[]) ?? []);
      setCommission((commData as unknown as CommissionRow[]) ?? []);
      setBatches((batchData as unknown as BatchRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Summary numbers (across BOTH streams) ──
  // OWED    = customer has paid, ready to be paid out to the worker.
  // PENDING = job done but customer hasn't paid yet (waiting on the customer).
  // PAID    = already settled by the owner (all-time).
  const sumBy = (status: PayStatus) =>
    labor.filter((p) => p.status === status).reduce((s, p) => s + Number(p.amount ?? 0), 0) +
    commission.filter((c) => c.status === status).reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const owed = sumBy("owed");
  const pending = sumBy("pending");
  const paid = sumBy("paid");

  // ── Combined chronological earnings list ──
  const rows: EarningRow[] = [
    ...labor.map((p): EarningRow => {
      const date = p.jobs?.scheduled_at ?? p.paid_at;
      return {
        id: `labor-${p.id}`,
        kind: "labor",
        name: p.jobs?.job_line_items?.[0]?.description ?? "Job",
        ts: date ? new Date(date).getTime() : 0,
        dateStr: date,
        basis: `Labor · ${laborBasis(p)}`,
        amount: Number(p.amount ?? 0),
        status: p.status,
      };
    }),
    ...commission.map((c): EarningRow => {
      const date = c.jobs?.scheduled_at ?? c.paid_at;
      return {
        id: `comm-${c.id}`,
        kind: "commission",
        name: c.jobs?.clients?.name ?? "Commission",
        ts: date ? new Date(date).getTime() : 0,
        dateStr: date,
        basis: `Commission · ${Number(c.rate ?? 0)}%`,
        amount: Number(c.amount ?? 0),
        status: c.status,
      };
    }),
  ].sort((a, b) => b.ts - a.ts);

  const hasEarnings = rows.length > 0;

  // ── Render ──
  if (!loading && !hasMembership) {
    return (
      <div className="flex flex-col gap-5 px-4 lg:px-8 py-6 max-w-xl mx-auto lg:max-w-2xl">
        <div>
          <p className="font-black text-xl text-foreground">My Earnings</p>
          <p className="text-sm text-muted-foreground mt-0.5">Your pay, commission &amp; payouts</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span
            className="material-symbols-outlined text-[48px] text-muted-foreground/30"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            payments
          </span>
          <p className="text-sm text-muted-foreground">Join a team to start tracking your earnings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 lg:px-8 py-6 max-w-xl mx-auto lg:max-w-2xl pb-32 lg:pb-8">

      {/* Header */}
      <div>
        <p className="font-black text-xl text-foreground">My Earnings</p>
        <p className="text-sm text-muted-foreground mt-0.5">Your pay, commission &amp; payouts</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-28 rounded-2xl bg-muted/50 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
            <div className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Summary: lead with OWED ── */}
          <Card className="rounded-2xl p-5 border-primary/30 bg-primary/8 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[20px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                account_balance_wallet
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">You&apos;re owed</p>
            </div>
            <p className="text-4xl font-black text-foreground leading-none mt-1">
              {formatCurrencyRounded(owed)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Ready to be paid out</p>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="rounded-2xl p-4 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending</span>
              <span className="text-2xl font-black text-foreground leading-none mt-1">
                {formatCurrencyRounded(pending)}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">Waiting on customer payment</span>
            </Card>
            <Card className="rounded-2xl p-4 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paid</span>
              <span className="text-2xl font-black text-foreground leading-none mt-1">
                {formatCurrencyRounded(paid)}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">Settled to date</span>
            </Card>
          </div>

          {/* ── Combined earnings list ── */}
          {hasEarnings ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Earnings</h3>
              <Card className="rounded-2xl overflow-hidden">
                <div className="divide-y divide-border/40">
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                          r.kind === "commission" ? "icon-violet" : "icon-primary"
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[17px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {r.kind === "commission" ? "percent" : "handyman"}
                        </span>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {r.basis} · {fmtDate(r.dateStr)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm font-extrabold text-foreground">{formatCurrency(r.amount)}</span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span
                className="material-symbols-outlined text-[48px] text-muted-foreground/30"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                payments
              </span>
              <p className="text-sm text-muted-foreground">No earnings yet</p>
              <p className="text-xs text-muted-foreground/60">
                Pay and commission show up here as you complete jobs
              </p>
            </div>
          )}

          {/* ── Payout history ── */}
          {batches.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Payout history</h3>
              <Card className="rounded-2xl overflow-hidden">
                <div className="divide-y divide-border/40">
                  {batches.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl icon-green">
                        <span
                          className="material-symbols-outlined text-[17px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(Number(b.total_amount ?? 0))} paid
                          {b.method ? ` via ${b.method}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(b.created_at)}
                          {Number(b.commission_total ?? 0) > 0 && Number(b.labor_total ?? 0) > 0
                            ? ` · ${formatCurrency(Number(b.labor_total))} labor + ${formatCurrency(Number(b.commission_total))} commission`
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
