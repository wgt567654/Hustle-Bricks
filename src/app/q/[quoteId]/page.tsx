"use client";

import { use, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/currency";

function formatProposedSchedule(date: string, time: string | null) {
  const dateStr = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  if (!time) return dateStr;
  const [h, m] = time.split(":").map(Number);
  const timeStr = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return `${dateStr} at ${timeStr}`;
}

type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type PublicQuote = {
  id: string;
  status: "draft" | "sent" | "accepted" | "declined";
  total: number;
  notes: string | null;
  video_url: string | null;
  created_at: string;
  proposed_date: string | null;
  proposed_time: string | null;
  businesses: {
    name: string;
    logo_url: string | null;
    invoice_message: string | null;
    terms_and_conditions: string | null;
    currency: string | null;
    financing_enabled: boolean | null;
    financing_url: string | null;
    financing_min_amount: number | null;
  } | null;
  clients: { name: string } | null;
  quote_line_items: QuoteLineItem[];
};

export default function ClientQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { quoteId } = use(params);
  const { t: linkToken } = use(searchParams);
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    const qs = linkToken ? `?t=${encodeURIComponent(linkToken)}` : "";
    fetch(`/api/quote-public/${quoteId}${qs}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        setQuote(data as PublicQuote);
        if (data.status === "accepted" || data.status === "declined") {
          setResponded(data.status);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [quoteId, linkToken]);

  async function respond(action: "accepted" | "declined") {
    setResponding(true);
    const res = await fetch("/api/quote-respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId, action, t: linkToken }),
    });
    if (res.ok) {
      setResponded(action);
      setQuote((q) => q ? { ...q, status: action } : q);
    }
    setResponding(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading your quote…</p>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-6 text-center">
        <p className="text-lg font-bold text-foreground">Quote not found</p>
        <p className="text-sm text-muted-foreground">This link may have expired or been removed.</p>
      </div>
    );
  }

  const currency = quote.businesses?.currency ?? "USD";
  const businessName = quote.businesses?.name ?? "Your service provider";

  const biz = quote.businesses;
  const showFinancing =
    biz?.financing_enabled &&
    biz.financing_url &&
    quote.total >= (biz.financing_min_amount ?? 500);

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 py-4">
        {quote.businesses?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={quote.businesses.logo_url} alt="Business logo" className="h-12 w-auto object-contain mb-3" />
        )}
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Quote from</p>
        <h1 className="text-xl font-extrabold text-foreground">{businessName}</h1>
        {quote.clients?.name && (
          <p className="text-sm text-muted-foreground mt-0.5">For {quote.clients.name}</p>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-5">

        {/* Status banner */}
        {responded === "accepted" && (
          <div className="status-accepted flex items-center gap-3 rounded-2xl border border-current/20 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-current/15">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm">Quote accepted!</p>
              <p className="text-xs mt-0.5 opacity-80">{businessName} will be in touch shortly to confirm scheduling.</p>
            </div>
          </div>
        )}

        {responded === "declined" && (
          <div className="status-declined flex items-center gap-3 rounded-2xl border border-current/20 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-current/15">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm">Quote declined</p>
              <p className="text-xs mt-0.5 opacity-80">Thanks for letting us know. Feel free to reach out if you change your mind.</p>
            </div>
          </div>
        )}

        {/* Video */}
        {quote.video_url && (
          <div className="rounded-2xl overflow-hidden border border-border bg-black shadow-card">
            <div className="px-4 pt-3 pb-2 bg-card border-b border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Video Walkthrough</p>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={quote.video_url}
              controls
              playsInline
              className="w-full max-h-[360px] bg-black"
            />
          </div>
        )}

        {/* Line items */}
        <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Services</p>
          </div>
          {quote.quote_line_items.map((item, i) => (
            <div key={item.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{item.description}</span>
                {item.quantity > 1 && (
                  <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                )}
              </div>
              <span className="text-sm font-bold text-foreground">
                {formatCurrency(item.unit_price * item.quantity, currency)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/50">
            <span className="font-bold text-sm text-foreground">Total</span>
            <span className="text-lg font-extrabold text-foreground">
              {formatCurrency(quote.total, currency)}
            </span>
          </div>
        </div>

        {/* Proposed service time */}
        {quote.proposed_date && (
          <div className="rounded-2xl bg-card border border-border shadow-card px-4 py-4 flex items-start gap-3">
            <div className="icon-primary flex size-10 shrink-0 items-center justify-center rounded-full">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Proposed service time</p>
              <p className="text-sm font-semibold text-foreground">
                {formatProposedSchedule(quote.proposed_date, quote.proposed_time)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Accepting sends this time to {businessName} for confirmation.</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div className="rounded-2xl bg-card border border-border shadow-card px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Note from {businessName}</p>
            <p className="text-sm text-foreground leading-relaxed">{quote.notes}</p>
          </div>
        )}

        {/* Financing option */}
        {showFinancing && (
          <div className="rounded-2xl bg-primary/10 border border-primary/20 shadow-card px-4 py-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="icon-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground text-sm">Finance this job</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Pay over time with low monthly payments. Quick 2-minute application — get a decision instantly. {businessName} gets paid in full.
                </p>
              </div>
            </div>
            <a
              href={biz!.financing_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm text-center active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Apply for Financing
            </a>
          </div>
        )}

        {/* Accept / Decline */}
        {quote.status === "sent" && !responded && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => respond("accepted")}
              disabled={responding}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {responding ? "Processing…" : "Accept Quote"}
            </button>
            <button
              onClick={() => respond("declined")}
              disabled={responding}
              className="w-full py-3.5 rounded-xl bg-primary/10 text-primary font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {responding ? "Processing…" : "Decline"}
            </button>
          </div>
        )}

        {/* Invoice message */}
        {quote.businesses?.invoice_message && (
          <div className="rounded-2xl bg-card border border-border shadow-card px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">A Note from {businessName}</p>
            <p className="text-sm text-foreground leading-relaxed">{quote.businesses.invoice_message}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        {quote.businesses?.terms_and_conditions && (
          <details className="rounded-2xl bg-card border border-border shadow-card overflow-hidden group">
            <summary className="px-4 py-4 flex items-center justify-between cursor-pointer list-none">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Terms &amp; Conditions</p>
              <svg className="w-4 h-4 text-muted-foreground group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{quote.businesses.terms_and_conditions}</p>
            </div>
          </details>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Powered by HustleBricks
        </p>
      </div>
    </div>
  );
}
