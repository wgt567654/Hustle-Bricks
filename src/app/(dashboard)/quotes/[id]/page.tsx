"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { STATUS_HEX, STATUS_CLASS } from "@/lib/status-colors";
import { formatCurrency } from "@/lib/currency";

type QuoteStatus = "draft" | "sent" | "accepted" | "declined";

type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type Quote = {
  id: string;
  status: QuoteStatus;
  total: number;
  created_at: string;
  notes: string | null;
  client_id: string;
  clients: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  quote_line_items: QuoteLineItem[];
};

const STATUS_BADGE: Record<QuoteStatus, { label: string; className: string }> = {
  draft:    { label: "Draft",       className: `${STATUS_CLASS.draft} border-0` },
  sent:     { label: "Quote Sent",  className: `${STATUS_CLASS.sent} border-0` },
  accepted: { label: "Won",         className: `${STATUS_CLASS.accepted} border-0` },
  declined: { label: "Lost",        className: `${STATUS_CLASS.declined} border-0` },
};

const STATUS_COLOR: Record<QuoteStatus, string> = {
  draft:    STATUS_HEX.draft,
  sent:     STATUS_HEX.sent,
  accepted: STATUS_HEX.accepted,
  declined: STATUS_HEX.declined,
};

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [acting, setActing] = useState(false);
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, currency")
        .eq("owner_id", user.id)
        .single();
      if (biz) {
        setBusinessId(biz.id);
        setCurrency(biz.currency ?? "USD");
      }

      const { data, error } = await supabase
        .from("quotes")
        .select("id, status, total, created_at, notes, client_id, clients(name, phone, email, address), quote_line_items(id, description, quantity, unit_price)")
        .eq("id", id)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const q = data as unknown as Quote;
      setQuote(q);

      // Check for linked job
      if (q.status === "accepted" || q.status === "declined") {
        const { data: jobData } = await supabase
          .from("jobs")
          .select("id")
          .eq("quote_id", id)
          .maybeSingle();
        if (jobData) setLinkedJobId(jobData.id);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  async function sendQuote() {
    if (!quote) return;
    setActing(true);
    const supabase = createClient();
    await supabase.from("quotes").update({ status: "sent" }).eq("id", quote.id);
    setQuote((q) => q ? { ...q, status: "sent" } : q);
    setActing(false);
  }

  async function markLost() {
    if (!quote) return;
    setActing(true);
    const supabase = createClient();
    await supabase.from("quotes").update({ status: "declined" }).eq("id", quote.id);
    setQuote((q) => q ? { ...q, status: "declined" } : q);
    setActing(false);
  }

  async function markWonAndCreateJob() {
    if (!quote || !businessId) return;
    setActing(true);
    const supabase = createClient();

    // Mark quote as accepted
    await supabase.from("quotes").update({ status: "accepted" }).eq("id", quote.id);

    // Create job
    const { data: job } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        client_id: quote.client_id,
        quote_id: quote.id,
        status: "scheduled",
        total: quote.total,
        notes: quote.notes,
      })
      .select("id")
      .single();

    // Copy line items
    if (job && quote.quote_line_items.length > 0) {
      await supabase.from("job_line_items").insert(
        quote.quote_line_items.map((li) => ({
          job_id: job.id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
        }))
      );
    }

    setActing(false);

    if (job) {
      router.push(`/jobs/${job.id}`);
    } else {
      setQuote((q) => q ? { ...q, status: "accepted" } : q);
    }
  }

  async function reopen() {
    if (!quote) return;
    setActing(true);
    const supabase = createClient();
    await supabase.from("quotes").update({ status: "sent" }).eq("id", quote.id);
    setQuote((q) => q ? { ...q, status: "sent" } : q);
    setActing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading quote…</p>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="font-bold text-foreground">Quote not found</p>
        <button onClick={() => router.push("/sales")} className="text-sm text-primary font-bold">← Back to Sales</button>
      </div>
    );
  }

  const badge = STATUS_BADGE[quote.status];
  const subtotal = quote.quote_line_items.reduce((s, li) => s + li.unit_price * li.quantity, 0);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto pb-28">

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => router.push("/sales")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="flex flex-col">
          <Badge variant="secondary" className={`w-fit mb-1 max-h-5 px-2 text-[10px] uppercase font-bold tracking-wider ${badge.className}`}>
            {badge.label}
          </Badge>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-tight">
            {quote.clients?.name ?? "Unknown client"}
          </h1>
        </div>
      </div>

      {/* Color accent stripe + Client card */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="h-1 w-full" style={{ backgroundColor: STATUS_COLOR[quote.status] }} />
        <div className="p-5 flex flex-col gap-4">

          {/* Client */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Client</span>
              <span className="text-sm font-bold text-foreground">{quote.clients?.name ?? "—"}</span>
              {quote.clients?.email && (
                <span className="text-xs text-muted-foreground truncate">{quote.clients.email}</span>
              )}
              {quote.clients?.address && (
                <span className="text-xs text-muted-foreground truncate mt-0.5">{quote.clients.address}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {quote.clients?.phone && (
                <a
                  href={`tel:${quote.clients.phone}`}
                  className="flex size-8 items-center justify-center rounded-full icon-green hover:opacity-80 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                </a>
              )}
              {quote.clients?.email && (
                <a
                  href={`mailto:${quote.clients.email}`}
                  className="flex size-8 items-center justify-center rounded-full icon-primary hover:opacity-80 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                </a>
              )}
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Date */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Created</span>
              <span className="text-sm font-bold text-foreground">
                {new Date(quote.created_at).toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric", year: "numeric",
                })}
              </span>
            </div>
          </div>

        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-[var(--color-status-in-progress)]/5 p-4 border-t border-[var(--color-status-in-progress)]/10 flex gap-3">
            <span className="material-symbols-outlined text-[var(--color-status-in-progress)] text-[20px] shrink-0 mt-0.5">sticky_note_2</span>
            <p className="text-sm text-[var(--color-status-in-progress)] font-medium leading-relaxed">{quote.notes}</p>
          </div>
        )}
      </Card>

      {/* Line items */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Line Items</h3>
          <span className="font-extrabold text-foreground">{formatCurrency(quote.total, currency)}</span>
        </div>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          {quote.quote_line_items.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">No line items</div>
          )}
          {quote.quote_line_items.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <Separator className="bg-border/50 mx-4" />}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-[18px] text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{item.description}</span>
                    {item.quantity > 1 && (
                      <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                    )}
                  </div>
                </div>
                <span className="font-bold text-sm text-foreground">
                  {formatCurrency(item.unit_price * item.quantity, currency)}
                </span>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* Totals */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-medium">Subtotal</span>
            <span className="text-sm font-bold text-foreground">{formatCurrency(subtotal, currency)}</span>
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-foreground">Total</span>
            <span className="text-lg font-extrabold text-foreground">{formatCurrency(quote.total, currency)}</span>
          </div>
        </div>
      </Card>

      {/* ── ACTION BAR ── */}

      {/* Draft: Send Quote */}
      {quote.status === "draft" && (
        <div className="fixed bottom-0 left-0 w-full z-40 bg-card border-t border-border p-4 pb-10">
          <div className="max-w-xl mx-auto">
            <button
              onClick={sendQuote}
              disabled={acting}
              className="w-full rounded-xl font-bold py-4 text-sm bg-primary text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              {acting ? "Sending…" : "Send Quote"}
            </button>
          </div>
        </div>
      )}

      {/* Sent: Mark Lost + Mark Won → Create Job */}
      {quote.status === "sent" && (
        <div className="fixed bottom-0 left-0 w-full z-40 bg-card border-t border-border p-4 pb-10">
          <div className="max-w-xl mx-auto flex gap-3">
            <button
              onClick={markLost}
              disabled={acting}
              className="flex-1 rounded-xl font-bold py-4 text-sm border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Mark Lost
            </button>
            <button
              onClick={markWonAndCreateJob}
              disabled={acting}
              className="flex-[2] rounded-xl font-bold py-4 text-sm bg-[var(--color-status-completed)] text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
              {acting ? "Creating job…" : "Mark Won → Create Job"}
            </button>
          </div>
        </div>
      )}

      {/* Accepted/completed: View Job if linked */}
      {(quote.status === "accepted") && linkedJobId && (
        <div className="fixed bottom-0 left-0 w-full z-40 bg-card border-t border-border p-4 pb-10">
          <div className="max-w-xl mx-auto">
            <button
              onClick={() => router.push(`/jobs/${linkedJobId}`)}
              className="w-full rounded-xl font-bold py-4 text-sm bg-primary text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>home_repair_service</span>
              View Job
            </button>
          </div>
        </div>
      )}

      {/* Declined: Reopen */}
      {quote.status === "declined" && (
        <div className="fixed bottom-0 left-0 w-full z-40 bg-card border-t border-border p-4 pb-10">
          <div className="max-w-xl mx-auto">
            <button
              onClick={reopen}
              disabled={acting}
              className="w-full rounded-xl font-bold py-4 text-sm border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
              {acting ? "Reopening…" : "Reopen Quote"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
