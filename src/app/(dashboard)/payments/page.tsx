"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatCurrencyRounded } from "@/lib/currency";

type Payment = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "refunded";
  paid_at: string | null;
  method: string | null;
  created_at: string;
};

type JobWithPayment = {
  id: string;
  total: number;
  completed_at: string | null;
  created_at: string;
  clients: { name: string; phone: string | null } | null;
  job_line_items: { description: string }[];
  payment: Payment | null;
};

type Filter = "unpaid" | "paid";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  check: "Check",
  venmo: "Venmo",
  zelle: "Zelle",
  other: "Other",
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: "payments" },
  { value: "card", label: "Card", icon: "credit_card" },
  { value: "check", label: "Check", icon: "receipt" },
  { value: "venmo", label: "Venmo", icon: "phone_iphone" },
  { value: "zelle", label: "Zelle", icon: "phone_iphone" },
  { value: "other", label: "Other", icon: "more_horiz" },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function PaymentsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithPayment[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("unpaid");

  // Mark paid modal
  const [payModal, setPayModal] = useState<JobWithPayment | null>(null);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  // Send invoice
  const [sentInvoiceId, setSentInvoiceId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: business } = await supabase
      .from("businesses")
      .select("id, currency")
      .eq("owner_id", user.id)
      .single();

    if (!business) {
      router.replace("/");
      return;
    }
    setBusinessId(business.id);
    setCurrency(business.currency ?? "USD");

    const { data: jobsData } = await supabase
      .from("jobs")
      .select("id, total, completed_at, created_at, clients(name, phone), job_line_items(description)")
      .eq("business_id", business.id)
      .in("status", ["completed", "in_progress"])
      .order("completed_at", { ascending: false, nullsFirst: false });

    if (!jobsData) { setLoading(false); return; }

    const jobIds = jobsData.map((j) => j.id);
    const { data: paymentsData } = jobIds.length > 0
      ? await supabase
          .from("payments")
          .select("id, job_id, amount, status, paid_at, method, created_at")
          .in("job_id", jobIds)
      : { data: [] };

    const paymentsByJob = Object.fromEntries(
      (paymentsData ?? []).map((p: Payment & { job_id: string }) => [p.job_id, p])
    );

    setJobs(
      jobsData.map((j) => ({
        ...j,
        clients: j.clients as unknown as { name: string; phone: string | null } | null,
        job_line_items: (j.job_line_items as { description: string }[]) ?? [],
        payment: paymentsByJob[j.id] ?? null,
      }))
    );
    setLoading(false);
  }

  function sendInvoice(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job?.clients?.phone) return;
    const serviceTitle = job.job_line_items[0]?.description ?? "service";
    const body = `Hi ${job.clients.name}! Your invoice for ${formatCurrency(job.total, currency)} (${serviceTitle}) is ready. Reply to confirm or call to pay. - HustleBricks`;
    window.location.href = `sms:${job.clients.phone}?body=${encodeURIComponent(body)}`;
    setSentInvoiceId(jobId);
    setTimeout(() => setSentInvoiceId(null), 3000);
  }

  function openPayModal(job: JobWithPayment) {
    setPayModal(job);
    setPayMethod("cash");
    setPayAmount(job.total.toFixed(2));
  }

  async function confirmMarkPaid() {
    if (!payModal || !businessId) return;
    setPaySaving(true);
    const supabase = createClient();

    if (payModal.payment) {
      await supabase
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString(), method: payMethod, amount: parseFloat(payAmount) || payModal.total })
        .eq("id", payModal.payment.id);
    } else {
      await supabase.from("payments").insert({
        business_id: businessId,
        job_id: payModal.id,
        amount: parseFloat(payAmount) || payModal.total,
        status: "paid",
        paid_at: new Date().toISOString(),
        method: payMethod,
      });
    }

    const now = new Date().toISOString();
    setJobs((prev) =>
      prev.map((j) =>
        j.id === payModal.id
          ? {
              ...j,
              payment: {
                id: j.payment?.id ?? "new",
                amount: parseFloat(payAmount) || j.total,
                status: "paid",
                paid_at: now,
                method: payMethod,
                created_at: now,
              },
            }
          : j
      )
    );
    setPaySaving(false);
    setPayModal(null);
  }

  const paidJobs = jobs.filter((j) => j.payment?.status === "paid");
  const unpaidJobs = jobs.filter((j) => !j.payment || j.payment.status !== "paid");

  const totalEarned = paidJobs.reduce((s, j) => s + (j.payment?.amount ?? j.total), 0);
  const totalOutstanding = unpaidJobs.reduce((s, j) => s + j.total, 0);

  const displayed = filter === "unpaid" ? unpaidJobs : paidJobs;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-8 py-6 max-w-xl mx-auto lg:max-w-none pb-40 lg:pb-8">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">Track earnings from completed jobs.</p>
      </div>

      {/* Earnings summary */}
      <section>
        <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-white shadow-2xl shadow-primary/30">
          <div className="absolute -right-12 -top-12 size-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 size-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>attach_money</span>
                </div>
                <span className="text-sm font-bold text-white/80 uppercase tracking-wider">Total Earned</span>
              </div>
              {totalOutstanding > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-white/70 bg-white/15 px-2.5 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                  {formatCurrencyRounded(totalOutstanding, currency)} pending
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-extrabold tracking-tighter text-white leading-none">
                {loading ? "—" : formatCurrencyRounded(totalEarned, currency)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/15 rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Jobs Paid</span>
                <span className="text-xl font-extrabold text-white leading-none">{loading ? "—" : paidJobs.length}</span>
              </div>
              <div
                className={`bg-white/15 rounded-2xl px-3 py-2.5 flex flex-col gap-0.5 ${unpaidJobs.length > 0 ? "cursor-pointer hover:bg-white/25 transition-colors" : ""}`}
                onClick={() => unpaidJobs.length > 0 && setFilter("unpaid")}
              >
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Outstanding</span>
                <span className={`text-xl font-extrabold leading-none ${unpaidJobs.length > 0 ? "text-[#fbbf24]" : "text-white"}`}>
                  {loading ? "—" : unpaidJobs.length > 0 ? unpaidJobs.length : "✓ Clear"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
        {([
          { label: "Unpaid", value: "unpaid" as Filter, count: unpaidJobs.length },
          { label: "Paid", value: "paid" as Filter, count: paidJobs.length },
        ]).map((tab) => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}>
            <Badge
              className={`px-4 py-1.5 text-xs rounded-full shrink-0 cursor-pointer transition-colors ${
                filter === tab.value
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
              }`}
              variant={filter === tab.value ? "default" : "outline"}
            >
              {tab.label}{tab.count > 0 ? ` (${tab.count})` : ""}
            </Badge>
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

        {!loading && displayed.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">
              {filter === "unpaid" ? "check_circle" : "receipt_long"}
            </span>
            <p className="text-sm font-medium text-muted-foreground">
              {filter === "unpaid" ? "All caught up — nothing unpaid!" : "No paid jobs yet"}
            </p>
            {filter === "paid" && (
              <p className="text-xs text-muted-foreground/60">Complete jobs and mark them paid to see them here</p>
            )}
          </div>
        )}

        {displayed.map((job) => {
          const serviceTitle = job.job_line_items[0]?.description ?? "Service Job";
          const isPaid = job.payment?.status === "paid";

          return (
            <Card key={job.id} className="overflow-hidden rounded-2xl border-border shadow-sm">
              <div className="h-1 w-full" style={{ backgroundColor: isPaid ? "#16a34a" : "#ea580c" }} />
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: isPaid ? "#16a34a" : "#ea580c" }}
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isPaid ? "check_circle" : "pending"}
                      </span>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-bold text-foreground text-sm leading-tight truncate">{serviceTitle}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {job.clients?.name ?? "Unknown client"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-extrabold text-foreground">{formatCurrency(job.payment?.amount ?? job.total, currency)}</span>
                    {isPaid
                      ? <Badge variant="secondary" className="icon-green  border-0 text-[10px]">Paid</Badge>
                      : <Badge variant="secondary" className="icon-orange  border-0 text-[10px]">Unpaid</Badge>
                    }
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {isPaid
                        ? `Paid ${formatDate(job.payment!.paid_at)}`
                        : job.completed_at
                        ? `Completed ${formatDate(job.completed_at)}`
                        : `Created ${formatDate(job.created_at)}`
                      }
                    </span>
                    {isPaid && job.payment?.method && (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-[10px] font-bold">
                        {METHOD_LABELS[job.payment.method] ?? job.payment.method}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="text-[11px] font-bold text-muted-foreground px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                    >
                      View Job
                    </button>
                    {!isPaid && job.clients?.phone && (
                      <button
                        onClick={() => sendInvoice(job.id)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors ${
                          sentInvoiceId === job.id
                            ? "text-[var(--color-status-completed)] bg-status-completed/10"
                            : "text-primary bg-primary/10 hover:bg-primary/20"
                        }`}
                      >
                        {sentInvoiceId === job.id ? "Opened!" : "Send Invoice"}
                      </button>
                    )}
                    {!isPaid && (
                      <button
                        onClick={() => openPayModal(job)}
                        className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-status-completed)] px-3 py-1.5 rounded-full bg-status-completed/10 hover:opacity-90 transition-colors"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── MARK PAID MODAL ── */}
      {payModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setPayModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[80vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden">
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 shrink-0">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Collect Payment</p>
                <h2 className="text-lg font-extrabold text-foreground leading-tight">
                  {payModal.clients?.name ?? "Unknown client"}
                </h2>
              </div>
              <button
                onClick={() => setPayModal(null)}
                className="flex size-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
              {/* Amount */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full rounded-xl border border-border bg-card pl-8 pr-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
              </div>

              {/* Method */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setPayMethod(m.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        payMethod === m.value
                          ? "bg-[var(--color-status-completed)] text-white shadow-sm"
                          : "bg-muted/50 text-foreground border border-border hover:bg-muted"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {m.icon}
                      </span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-2" />
            </div>

            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background">
              <button
                onClick={confirmMarkPaid}
                disabled={paySaving}
                className="w-full py-3.5 rounded-2xl bg-[var(--color-status-completed)] text-white font-extrabold text-sm hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-md flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">attach_money</span>
                {paySaving ? "Saving…" : `Record ${formatCurrency(parseFloat(payAmount || "0"), currency)} · ${METHOD_LABELS[payMethod] ?? payMethod}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
