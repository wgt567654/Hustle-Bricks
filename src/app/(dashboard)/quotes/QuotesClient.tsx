"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { STATUS_CLASS, type QuoteStatus } from "@/lib/status-colors";

type Quote = {
  id: string;
  status: QuoteStatus;
  total: number;
  created_at: string;
  clients: { name: string } | null;
  quote_line_items: { description: string }[];
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
};

const FILTER_TABS: { label: string; value: QuoteStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Drafts", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Accepted", value: "accepted" },
  { label: "Declined", value: "declined" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function QuotesClient({
  initialQuotes,
  initialBusinessId,
  initialCurrency,
}: {
  initialQuotes: Quote[];
  initialBusinessId: string | null;
  initialCurrency: string;
}) {
  const router = useRouter();
  const quotes = initialQuotes;
  const currency = initialCurrency;
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuoteStatus | "all">("all");

  const filtered = quotes.filter((q) => {
    const clientName = q.clients?.name ?? "";
    const lineItems = q.quote_line_items.map((li) => li.description).join(" ");
    const matchesSearch =
      clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lineItems.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || q.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const openValue = quotes
    .filter((q) => q.status === "draft" || q.status === "sent")
    .reduce((sum, q) => sum + q.total, 0);
  const acceptedCount = quotes.filter((q) => q.status === "accepted").length;
  const declinedCount = quotes.filter((q) => q.status === "declined").length;
  const winRate =
    acceptedCount + declinedCount > 0
      ? Math.round((acceptedCount / (acceptedCount + declinedCount)) * 100)
      : null;

  const countFor = (value: QuoteStatus | "all") =>
    value === "all" ? quotes.length : quotes.filter((q) => q.status === value).length;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-4 lg:pb-8">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Quotes</h1>
        <p className="text-xs text-muted-foreground">Estimates you&apos;ve drafted and sent.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Open Value
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(openValue, currency)}
          </span>
          <span className="text-xs text-muted-foreground">Draft + sent quotes</span>
        </Card>
        <Card className="rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Win Rate
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-foreground">
            {winRate === null ? "—" : `${winRate}%`}
          </span>
          <span className="text-xs text-muted-foreground">
            {winRate === null ? "No responses yet" : `${acceptedCount} accepted`}
          </span>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted-foreground">
          <span className="material-symbols-outlined text-[20px]">search</span>
        </div>
        <input
          type="text"
          aria-label="Search quotes"
          className="block w-full rounded-2xl border-0 py-3.5 pl-11 pr-4 text-foreground bg-card shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring text-sm transition-all focus:outline-none"
          placeholder="Search by client or service…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <button key={tab.value} onClick={() => setActiveFilter(tab.value)}>
            <Badge
              className={`px-4 py-1.5 text-xs rounded-full shrink-0 cursor-pointer transition-colors ${
                activeFilter === tab.value
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
              }`}
              variant={activeFilter === tab.value ? "default" : "outline"}
            >
              {tab.label} ({countFor(tab.value)})
            </Badge>
          </button>
        ))}
      </div>

      {/* Quote list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">
              {searchQuery || activeFilter !== "all" ? "search_off" : "request_quote"}
            </span>
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery || activeFilter !== "all"
                ? "No quotes match your filters"
                : "No quotes yet"}
            </p>
            {!searchQuery && activeFilter === "all" && (
              <p className="text-xs text-muted-foreground/60">
                Tap + to draft your first quote
              </p>
            )}
          </div>
        )}

        {filtered.map((quote) => (
          <Card
            key={quote.id}
            onClick={() => router.push(`/quotes/${quote.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/quotes/${quote.id}`);
              }
            }}
            className="overflow-hidden rounded-2xl cursor-pointer p-4 press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <h3 className="font-bold text-lg text-foreground leading-tight truncate">
                  {quote.clients?.name ?? "No client"}
                </h3>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {formatDate(quote.created_at)}
                </span>
              </div>
              <span
                className={`${STATUS_CLASS[quote.status]} shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider`}
              >
                {STATUS_LABELS[quote.status]}
              </span>
            </div>

            {quote.quote_line_items.length > 0 && (
              <p className="text-sm font-medium text-muted-foreground truncate mb-3">
                {quote.quote_line_items.map((li) => li.description).join(" · ")}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-xs text-muted-foreground">
                {quote.quote_line_items.length}{" "}
                {quote.quote_line_items.length === 1 ? "item" : "items"}
              </span>
              <span className="text-lg font-extrabold tracking-tight text-foreground">
                {formatCurrency(quote.total, currency)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Floating new-quote button */}
      {initialBusinessId && (
        <button
          onClick={() => router.push("/quotes/new")}
          aria-label="New quote"
          className="fixed right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white press shadow-lg shadow-primary/30"
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      )}
    </div>
  );
}
