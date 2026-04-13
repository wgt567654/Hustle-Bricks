"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatCurrencyRounded } from "@/lib/currency";

type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";
type PlanStatus = "active" | "paused" | "cancelled";

type Plan = {
  id: string;
  client_id: string;
  name: string;
  frequency: Frequency;
  price: number;
  status: PlanStatus;
  next_service_date: string | null;
  notes: string | null;
  clients: { id: string; name: string } | null;
};

type Client = { id: string; name: string };

const FREQ_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  biweekly: "Bi-Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annual",
};

const FREQ_COLORS: Record<Frequency, string> = {
  weekly: "bg-primary/10 text-primary",
  biweekly: "icon-violet",
  monthly: "icon-green ",
  quarterly: "icon-orange ",
  annually: "bg-foreground/10 text-foreground",
};

function getNextDate(fromDate: string, frequency: Frequency): string {
  const d = new Date(fromDate);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "annually": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr + "T12:00:00") < new Date();
}

const EMPTY_FORM = {
  client_id: "",
  name: "",
  frequency: "monthly" as Frequency,
  price: "",
  next_service_date: "",
  notes: "",
};

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "all">("active");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id, currency")
        .eq("owner_id", user.id)
        .single();
      if (!business) return;
      setBusinessId(business.id);
      setCurrency(business.currency ?? "USD");

      const [{ data: plansData }, { data: clientsData }] = await Promise.all([
        supabase
          .from("service_plans")
          .select("id, client_id, name, frequency, price, status, next_service_date, notes, clients(id, name)")
          .eq("business_id", business.id)
          .order("next_service_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("clients")
          .select("id, name")
          .eq("business_id", business.id)
          .order("name"),
      ]);

      setPlans((plansData as unknown as Plan[]) ?? []);
      setClients(clientsData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = statusFilter === "all" ? plans : plans.filter((p) => p.status === statusFilter);

  function openAdd() {
    setEditPlan(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(plan: Plan) {
    setEditPlan(plan);
    setForm({
      client_id: plan.client_id,
      name: plan.name,
      frequency: plan.frequency,
      price: String(plan.price),
      next_service_date: plan.next_service_date ?? "",
      notes: plan.notes ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!businessId || !form.client_id || !form.name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      business_id: businessId,
      client_id: form.client_id,
      name: form.name.trim(),
      frequency: form.frequency,
      price: parseFloat(form.price) || 0,
      next_service_date: form.next_service_date || null,
      notes: form.notes.trim() || null,
    };

    if (editPlan) {
      await supabase.from("service_plans").update(payload).eq("id", editPlan.id);
      const client = clients.find((c) => c.id === form.client_id);
      setPlans((prev) => prev.map((p) =>
        p.id === editPlan.id
          ? { ...p, ...payload, status: editPlan.status, clients: client ? { id: client.id, name: client.name } : p.clients }
          : p
      ));
    } else {
      const { data } = await supabase
        .from("service_plans")
        .insert({ ...payload, status: "active" })
        .select("id, client_id, name, frequency, price, status, next_service_date, notes, clients(id, name)")
        .single();
      if (data) setPlans((prev) => [...prev, data as unknown as Plan]);
    }

    setSaving(false);
    setShowModal(false);
  }

  async function updateStatus(planId: string, status: PlanStatus) {
    const supabase = createClient();
    await supabase.from("service_plans").update({ status }).eq("id", planId);
    setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, status } : p));
  }

  async function generateJob(plan: Plan) {
    if (!businessId) return;
    setGeneratingId(plan.id);
    const supabase = createClient();

    const scheduledAt = plan.next_service_date
      ? new Date(plan.next_service_date + "T09:00:00").toISOString()
      : new Date().toISOString();

    const { data: job } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        client_id: plan.client_id,
        status: "scheduled",
        scheduled_at: scheduledAt,
        total: plan.price,
        notes: `Auto-generated from plan: ${plan.name}`,
      })
      .select("id")
      .single();

    if (job) {
      await supabase.from("job_line_items").insert({
        job_id: job.id,
        description: plan.name,
        quantity: 1,
        unit_price: plan.price,
      });

      // Advance next_service_date
      const nextDate = plan.next_service_date
        ? getNextDate(plan.next_service_date, plan.frequency)
        : getNextDate(new Date().toISOString().split("T")[0], plan.frequency);

      await supabase.from("service_plans").update({ next_service_date: nextDate }).eq("id", plan.id);
      setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, next_service_date: nextDate } : p));

      setGeneratingId(null);
      router.push(`/jobs/${job.id}`);
    } else {
      setGeneratingId(null);
    }
  }

  const activeCount = plans.filter((p) => p.status === "active").length;
  const monthlyRecurring = plans
    .filter((p) => p.status === "active")
    .reduce((s, p) => {
      const monthly = { weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 0.33, annually: 0.083 };
      return s + p.price * (monthly[p.frequency] ?? 1);
    }, 0);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-8 py-6 max-w-xl mx-auto lg:max-w-none pb-40 lg:pb-8">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Service Plans</h1>
        <p className="text-sm text-muted-foreground">Recurring maintenance schedules.</p>
      </div>

      {/* MRR summary */}
      {activeCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Est. Monthly</span>
            <span className="text-xl font-extrabold text-highlight-violet tracking-tight">
              {formatCurrencyRounded(monthlyRecurring, currency)}
            </span>
            <span className="text-[10px] text-muted-foreground">recurring revenue</span>
          </Card>
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Plans</span>
            <span className="text-xl font-extrabold text-foreground tracking-tight">{activeCount}</span>
            <span className="text-[10px] text-muted-foreground">across {new Set(plans.filter((p) => p.status === "active").map((p) => p.client_id)).size} clients</span>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([
          { label: "Active", value: "active" as const },
          { label: "All Plans", value: "all" as const },
          { label: "Paused", value: "paused" as const },
        ]).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-white"
                : "bg-card border border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Plans list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">autorenew</span>
            <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
            <p className="text-xs text-muted-foreground/60">Tap + to create a recurring service plan</p>
          </div>
        )}

        {filtered.map((plan) => {
          const overdue = isOverdue(plan.next_service_date);
          return (
            <Card key={plan.id} className="overflow-hidden rounded-2xl border-border shadow-sm group hover:border-primary/30 transition-colors">
              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col flex-1 min-w-0">
                    <h3 className="font-bold text-base text-foreground leading-tight truncate">{plan.name}</h3>
                    <span className="text-sm text-muted-foreground">{plan.clients?.name ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-extrabold text-base text-foreground">{formatCurrency(plan.price, currency)}</span>
                    <button
                      onClick={() => openEdit(plan)}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className={`border-0 text-[10px] font-bold ${FREQ_COLORS[plan.frequency]}`}>
                    <span className="material-symbols-outlined text-[10px] mr-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>autorenew</span>
                    {FREQ_LABELS[plan.frequency]}
                  </Badge>
                  {plan.status === "paused" && (
                    <Badge variant="secondary" className="border-0 text-[10px] font-bold bg-muted text-muted-foreground">Paused</Badge>
                  )}
                  {plan.next_service_date && (
                    <span className={`text-xs font-medium ${overdue ? "text-[var(--color-status-in-progress)]" : "text-muted-foreground"}`}>
                      {overdue ? "⚠ Overdue · " : "Next: "}
                      {formatDate(plan.next_service_date)}
                    </span>
                  )}
                </div>

                {plan.notes && (
                  <p className="text-xs text-muted-foreground">{plan.notes}</p>
                )}
              </div>

              <Separator className="bg-border/50" />
              <div className="flex bg-muted/30">
                {plan.status === "active" ? (
                  <>
                    <button
                      onClick={() => generateJob(plan)}
                      disabled={generatingId === plan.id}
                      className="flex-1 py-2.5 text-sm font-semibold text-primary hover:text-white hover:bg-primary transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_task</span>
                      {generatingId === plan.id ? "Generating…" : "Generate Job"}
                    </button>
                    <Separator orientation="vertical" className="bg-border/50 h-auto" />
                    <button
                      onClick={() => updateStatus(plan.id, "paused")}
                      className="flex-1 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">pause</span>
                      Pause
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => updateStatus(plan.id, "active")}
                      className="flex-1 py-2.5 text-sm font-semibold text-[var(--color-status-completed)] hover:opacity-90 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                      Resume
                    </button>
                    <Separator orientation="vertical" className="bg-border/50 h-auto" />
                    <button
                      onClick={() => updateStatus(plan.id, "cancelled")}
                      className="flex-1 py-2.5 text-sm font-semibold text-muted-foreground hover:text-red-500 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* FAB */}
      <button
        onClick={openAdd}
        className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-primary/40 shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <h2 className="text-lg font-extrabold text-foreground">{editPlan ? "Edit Plan" : "New Service Plan"}</h2>
              <button onClick={() => setShowModal(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</label>
                <select
                  value={form.client_id}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Window Cleaning"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Frequency</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as Frequency }))}
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                      <option key={f} value={f}>{FREQ_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Service Date <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                <input
                  type="date"
                  value={form.next_service_date}
                  onChange={(e) => setForm((f) => ({ ...f, next_service_date: e.target.value }))}
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                <textarea
                  placeholder="Plan details, inclusions…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="flex w-full rounded-xl border border-border bg-transparent px-3 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !form.client_id || !form.name.trim()}
                className="w-full mt-1 rounded-xl font-bold py-3.5 text-sm bg-primary text-white shadow-md hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? "Saving…" : editPlan ? "Save Changes" : "Create Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
