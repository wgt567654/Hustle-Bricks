"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

type QuoteStatus = "draft" | "sent" | "accepted" | "declined";

type Quote = {
  id: string;
  status: QuoteStatus;
  total: number;
  created_at: string;
  notes: string | null;
  clients: { name: string; tag: string } | null;
  quote_line_items: { description: string }[];
};

const STATUS_FILTER: { label: string; value: "active" | "won" | "lost" }[] = [
  { label: "Active Pipeline", value: "active" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (days === 0) return hours <= 1 ? "Just now" : `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export default function SalesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"active" | "won" | "lost">("active");
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (!business) return;
      setBusinessId(business.id);

      const { data } = await supabase
        .from("quotes")
        .select("id, status, total, created_at, notes, clients(name, tag), quote_line_items(description)")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });

      setQuotes((data as unknown as Quote[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const activeQuotes = quotes.filter((q) => q.status === "draft" || q.status === "sent");
  const wonQuotes = quotes.filter((q) => q.status === "accepted");
  const lostQuotes = quotes.filter((q) => q.status === "declined");

  const pipelineValue = activeQuotes.reduce((s, q) => s + q.total, 0);
  const decidedCount = wonQuotes.length + lostQuotes.length;
  const closeRate = decidedCount > 0 ? Math.round((wonQuotes.length / decidedCount) * 100) : 0;

  const displayedQuotes =
    activeFilter === "active" ? activeQuotes :
    activeFilter === "won" ? wonQuotes : lostQuotes;

  async function updateStatus(quoteId: string, status: QuoteStatus) {
    setActingId(quoteId);
    const supabase = createClient();
    await supabase.from("quotes").update({ status }).eq("id", quoteId);
    setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, status } : q));
    setActingId(null);
  }

  async function markWonAndCreateJob(quote: Quote) {
    if (!businessId || !quote.clients) return;
    setActingId(quote.id);
    const supabase = createClient();

    // 1. Get the client id
    const { data: clientData } = await supabase
      .from("clients")
      .select("id")
      .eq("business_id", businessId)
      .eq("name", quote.clients.name)
      .single();

    if (!clientData) { setActingId(null); return; }

    // 2. Mark quote as accepted
    await supabase.from("quotes").update({ status: "accepted" }).eq("id", quote.id);

    // 3. Create job
    const { data: job } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        client_id: clientData.id,
        quote_id: quote.id,
        status: "scheduled",
        total: quote.total,
        notes: quote.notes,
      })
      .select("id")
      .single();

    // 4. Copy line items to job
    if (job) {
      const { data: lineItems } = await supabase
        .from("quote_line_items")
        .select("service_id, description, quantity, unit_price")
        .eq("quote_id", quote.id);

      if (lineItems && lineItems.length > 0) {
        await supabase.from("job_line_items").insert(
          lineItems.map((li) => ({ ...li, job_id: job.id }))
        );
      }
    }

    setQuotes((prev) => prev.map((q) => q.id === quote.id ? { ...q, status: "accepted" } : q));
    setActingId(null);

    if (job) router.push(`/jobs/${job.id}`);
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-40">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Sales Pipeline</h1>
        <p className="text-sm text-muted-foreground">Track quotes and close deals.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipeline Value</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold opacity-80">$</span>
            <span className="text-3xl font-extrabold tracking-tight text-[#007AFF]">
              {pipelineValue.toFixed(0)}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground">{activeQuotes.length} open quote{activeQuotes.length !== 1 ? "s" : ""}</span>
        </Card>

        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Close Rate</span>
          <div className={`flex items-baseline gap-1 ${closeRate >= 50 ? "text-[#16a34a]" : closeRate > 0 ? "text-[#ea580c]" : "text-foreground"}`}>
            <span className="text-3xl font-extrabold tracking-tight">{closeRate}</span>
            <span className="text-xl font-bold opacity-80">%</span>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground">
            {wonQuotes.length} won · {lostQuotes.length} lost
          </span>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
        {STATUS_FILTER.map((tab) => {
          const count = tab.value === "active" ? activeQuotes.length : tab.value === "won" ? wonQuotes.length : lostQuotes.length;
          return (
            <button key={tab.value} onClick={() => setActiveFilter(tab.value)}>
              <Badge
                className={`px-4 py-1.5 text-xs rounded-full shrink-0 cursor-pointer transition-colors ${
                  activeFilter === tab.value
                    ? "bg-[#007AFF] text-white hover:bg-[#007AFF]/90"
                    : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
                }`}
                variant={activeFilter === tab.value ? "default" : "outline"}
              >
                {tab.label} {count > 0 && `(${count})`}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Quote list */}
      <div className="flex flex-col gap-3">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

        {!loading && displayedQuotes.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">request_quote</span>
            <p className="text-sm font-medium text-muted-foreground">
              {activeFilter === "active" ? "No open quotes" : activeFilter === "won" ? "No won quotes yet" : "No lost quotes"}
            </p>
            {activeFilter === "active" && (
              <p className="text-xs text-muted-foreground/60">Tap + to create your first quote</p>
            )}
          </div>
        )}

        {displayedQuotes.map((quote) => {
          const services = quote.quote_line_items.map((li) => li.description).join(", ");
          const isActing = actingId === quote.id;

          return (
            <Card key={quote.id} onClick={() => router.push('/quotes/' + quote.id)} className="overflow-hidden rounded-2xl border-border shadow-sm flex flex-col gap-0 cursor-pointer hover:shadow-md transition-all hover:border-[#007AFF]/20">
              <div className="h-1 w-full" style={{ backgroundColor: quote.status === "draft" ? "#6b7280" : quote.status === "sent" ? "#007AFF" : quote.status === "accepted" ? "#16a34a" : "#ef4444" }} />
              <div className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1 min-w-0 pr-2">
                  <h3 className="font-bold text-foreground leading-tight">{quote.clients?.name ?? "Unknown client"}</h3>
                  <span className="text-sm font-medium text-muted-foreground truncate">{services || "No services"}</span>
                </div>
                <span className="font-extrabold text-foreground shrink-0">${quote.total.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between">
                {quote.status === "draft" && <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">Draft</Badge>}
                {quote.status === "sent" && <Badge variant="secondary" className="bg-[#007AFF]/10 text-[#007AFF] border-0">Quote Sent</Badge>}
                {quote.status === "accepted" && <Badge variant="secondary" className="bg-[#16a34a]/10 text-[#16a34a] border-0">Won ✓</Badge>}
                {quote.status === "declined" && <Badge variant="secondary" className="bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400 border-0">Lost</Badge>}

                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  {timeAgo(quote.created_at)}
                </div>
              </div>

              {/* Contextual actions */}
              {quote.status === "draft" && (
                <div className="flex gap-2 pt-1 border-t border-border">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus(quote.id, "sent"); }}
                    disabled={isActing}
                    className="flex-1 rounded-xl font-bold py-2.5 text-sm bg-[#007AFF] text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isActing ? "Sending…" : "Send Quote"}
                  </button>
                </div>
              )}

              {quote.status === "sent" && (
                <div className="flex gap-2 pt-1 border-t border-border">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus(quote.id, "declined"); }}
                    disabled={isActing}
                    className="flex-1 rounded-xl font-bold py-2.5 text-sm border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    Mark Lost
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); markWonAndCreateJob(quote); }}
                    disabled={isActing}
                    className="flex-1 rounded-xl font-bold py-2.5 text-sm bg-[#16a34a] text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isActing ? "Creating job…" : "Mark Won → Job"}
                  </button>
                </div>
              )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* New quote button */}
      <button
        onClick={() => router.push("/quotes/new")}
        className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-[#007AFF] text-white shadow-[#007AFF]/40 shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
