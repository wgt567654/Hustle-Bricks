"use client";

import { use, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/currency";

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

export default function ClientQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = use(params);
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    fetch(`/api/quote-public/${quoteId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        setQuote(data as PublicQuote);
        if (data.status === "accepted" || data.status === "declined") {
          setResponded(data.status);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [quoteId]);

  async function respond(action: "accepted" | "declined") {
    setResponding(true);
    const res = await fetch("/api/quote-respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId, action }),
    });
    if (res.ok) {
      setResponded(action);
      setQuote((q) => q ? { ...q, status: action } : q);
    }
    setResponding(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading your quote…</p>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3 px-6 text-center">
        <p className="text-lg font-bold text-gray-700">Quote not found</p>
        <p className="text-sm text-gray-400">This link may have expired or been removed.</p>
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
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4">
        {quote.businesses?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={quote.businesses.logo_url} alt="Business logo" className="h-12 w-auto object-contain mb-3" />
        )}
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">Quote from</p>
        <h1 className="text-xl font-extrabold text-gray-900">{businessName}</h1>
        {quote.clients?.name && (
          <p className="text-sm text-gray-500 mt-0.5">For {quote.clients.name}</p>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-5">

        {/* Status banner */}
        {responded === "accepted" && (
          <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-200 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-green-800 text-sm">Quote accepted!</p>
              <p className="text-xs text-green-600 mt-0.5">{businessName} will be in touch shortly to confirm scheduling.</p>
            </div>
          </div>
        )}

        {responded === "declined" && (
          <div className="flex items-center gap-3 rounded-2xl bg-gray-100 border border-gray-200 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-200">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-700 text-sm">Quote declined</p>
              <p className="text-xs text-gray-500 mt-0.5">Thanks for letting us know. Feel free to reach out if you change your mind.</p>
            </div>
          </div>
        )}

        {/* Video */}
        {quote.video_url && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black shadow-sm">
            <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Video Walkthrough</p>
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
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-gray-100">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Services</p>
          </div>
          {quote.quote_line_items.map((item, i) => (
            <div key={item.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-gray-800">{item.description}</span>
                {item.quantity > 1 && (
                  <span className="text-xs text-gray-400">×{item.quantity}</span>
                )}
              </div>
              <span className="text-sm font-bold text-gray-800">
                {formatCurrency(item.unit_price * item.quantity, currency)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="font-bold text-sm text-gray-700">Total</span>
            <span className="text-lg font-extrabold text-gray-900">
              {formatCurrency(quote.total, currency)}
            </span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Note from {businessName}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{quote.notes}</p>
          </div>
        )}

        {/* Financing option */}
        {showFinancing && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 shadow-sm px-4 py-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-blue-900 text-sm">Finance this job</p>
                <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                  Pay over time with low monthly payments. Quick 2-minute application — get a decision instantly. {businessName} gets paid in full.
                </p>
              </div>
            </div>
            <a
              href={biz!.financing_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm text-center active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
              className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {responding ? "Processing…" : "Accept Quote"}
            </button>
            <button
              onClick={() => respond("declined")}
              disabled={responding}
              className="w-full py-3.5 rounded-2xl border border-gray-300 bg-white text-gray-600 font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {responding ? "Processing…" : "Decline"}
            </button>
          </div>
        )}

        {/* Invoice message */}
        {quote.businesses?.invoice_message && (
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">A Note from {businessName}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{quote.businesses.invoice_message}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        {quote.businesses?.terms_and_conditions && (
          <details className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden group">
            <summary className="px-4 py-4 flex items-center justify-between cursor-pointer list-none">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Terms &amp; Conditions</p>
              <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.businesses.terms_and_conditions}</p>
            </div>
          </details>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by HustleBricks
        </p>
      </div>
    </div>
  );
}
