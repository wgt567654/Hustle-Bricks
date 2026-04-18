import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./PrintButton";
import { EmailInvoiceButton } from "./EmailInvoiceButton";
import { StripePaymentForm } from "./StripePaymentForm";
import { formatCurrency } from "@/lib/currency";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type Payment = {
  id: string;
  status: string;
  paid_at: string | null;
  method: string | null;
  amount: number;
};

type InvoiceJob = {
  id: string;
  status: string;
  total: number;
  scheduled_at: string | null;
  notes: string | null;
  signature_url: string | null;
  businesses: {
    name: string;
    currency: string | null;
    venmo_username: string | null;
    cashapp_tag: string | null;
    check_payable_to: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    stripe_connect_account_id: string | null;
    stripe_connect_status: string | null;
  } | null;
  clients: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  job_line_items: LineItem[];
  payments: Payment[];
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  check: "Check",
  venmo: "Venmo",
  zelle: "Zelle",
  other: "Other",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}


export default async function InvoicePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, status, total, scheduled_at, notes, signature_url, businesses(name, currency, venmo_username, cashapp_tag, check_payable_to, contact_email, contact_phone, stripe_connect_account_id, stripe_connect_status), clients(name, email, phone, address), job_line_items(id, description, quantity, unit_price), payments(id, status, paid_at, method, amount)"
    )
    .eq("id", jobId)
    .single();

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Invoice not found</h1>
          <p className="text-sm text-gray-500">This invoice link may be invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const job = data as unknown as InvoiceJob;
  const currency = job.businesses?.currency ?? "USD";

  const paidPayment = job.payments?.find((p) => p.status === "paid") ?? null;
  const isPaid = !!paidPayment;
  const refNum = `#JB-${job.id.slice(0, 6).toUpperCase()}`;
  const subtotal = job.job_line_items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              {job.businesses?.name ?? "HustleBricks"}
            </h1>
            <p className="text-sm text-gray-500 font-medium">Invoice</p>
            <p className="text-xs text-gray-400 font-mono mt-1">{refNum}</p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Status badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-extrabold uppercase tracking-wider ${
                isPaid
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isPaid ? "bg-green-500" : "bg-amber-500"
                }`}
              />
              {isPaid ? "PAID" : "UNPAID"}
            </span>

            {/* Action buttons */}
            <div className="print-hidden flex flex-col items-end gap-2">
              <PrintButton />
              <EmailInvoiceButton jobId={job.id} clientEmail={job.clients?.email} />
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-gray-200 mb-8" />

        {/* Client + Date info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Billed To</p>
            <p className="font-bold text-gray-900 text-base">{job.clients?.name ?? "—"}</p>
            {job.clients?.address && (
              <p className="text-sm text-gray-600 leading-relaxed">{job.clients.address}</p>
            )}
            {job.clients?.phone && (
              <p className="text-sm text-gray-600">{job.clients.phone}</p>
            )}
            {job.clients?.email && (
              <p className="text-sm text-gray-600">{job.clients.email}</p>
            )}
          </div>

          <div className="flex flex-col gap-1 items-end text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Details</p>
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-700">Invoice:</span> {refNum}
            </p>
            {job.scheduled_at && (
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">Date:</span>{" "}
                {formatDate(job.scheduled_at)}
              </p>
            )}
            {isPaid && paidPayment?.paid_at && (
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">Paid:</span>{" "}
                {formatDate(paidPayment.paid_at)}
              </p>
            )}
          </div>
        </div>

        {/* Line items table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 pr-4">
                  Description
                </th>
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 px-4 w-16">
                  Qty
                </th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 px-4 w-28">
                  Unit Price
                </th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3 pl-4 w-28">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {job.job_line_items.map((item, i) => (
                <tr
                  key={item.id}
                  className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}
                >
                  <td className="py-3.5 pr-4 text-sm font-medium text-gray-800">
                    {item.description}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-center text-gray-600">
                    {item.quantity}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-right text-gray-600">
                    {formatCurrency(item.unit_price, currency)}
                  </td>
                  <td className="py-3.5 pl-4 text-sm text-right font-semibold text-gray-900">
                    {formatCurrency(item.unit_price * item.quantity, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 flex flex-col gap-2">
            <div className="flex items-center justify-between py-2 border-t border-gray-200">
              <span className="text-sm text-gray-500">Subtotal</span>
              <span className="text-sm font-semibold text-gray-700">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t-2 border-gray-900">
              <span className="text-base font-extrabold text-gray-900">Total</span>
              <span className="text-xl font-extrabold text-gray-900">{formatCurrency(job.total, currency)}</span>
            </div>
          </div>
        </div>

        {/* Paid confirmation box */}
        {isPaid && paidPayment && (
          <div className="mb-8 rounded-2xl bg-green-50 border border-green-200 p-5 flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-600">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-green-800 text-sm">Payment received</p>
              <p className="text-sm text-green-700">
                Paid on {formatDate(paidPayment.paid_at)}
                {paidPayment.method
                  ? ` via ${METHOD_LABELS[paidPayment.method] ?? paidPayment.method}`
                  : ""}
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        {job.notes && (
          <div className="mb-8 rounded-2xl bg-gray-50 border border-gray-200 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Notes</p>
            <p className="text-sm text-gray-700 leading-relaxed">{job.notes}</p>
          </div>
        )}

        {/* Signature */}
        {job.signature_url && (
          <div className="mb-8 rounded-2xl bg-gray-50 border border-gray-200 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Customer Signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.signature_url}
              alt="Customer signature"
              className="max-h-24 w-auto object-contain"
            />
          </div>
        )}

        {/* Payment options — only show if unpaid */}
        {!isPaid && (
          <div className="mb-8 rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">How to Pay</p>
            </div>
            <div className="flex flex-col divide-y divide-gray-100">
              {/* Stripe card payment — only available when business has an active connected account */}
              {job.businesses?.stripe_connect_status === "active" &&
                job.businesses?.stripe_connect_account_id && (
                <StripePaymentForm
                  jobId={job.id}
                  amount={job.total}
                  currency={currency}
                  stripeAccount={job.businesses.stripe_connect_account_id}
                />
              )}
              {job.businesses?.venmo_username && (
                <a
                  href={`https://venmo.com/${job.businesses.venmo_username}?txn=pay&amount=${job.total}&note=${encodeURIComponent(refNum)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#008CFF]/10">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#008CFF]">
                      <path d="M19.2 2c.6 1 .9 2 .9 3.3 0 4.1-3.5 9.4-6.3 13.1H7.5L5 3.1l5.8-.6 1.3 10.4c1.2-2 2.7-5.1 2.7-7.2 0-1.2-.2-2-.5-2.7H19.2z"/>
                    </svg>
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-900 text-sm">Pay with Venmo</span>
                    <span className="text-xs text-gray-500">@{job.businesses.venmo_username} · {formatCurrency(job.total, currency)}</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 group-hover:text-[#008CFF] transition-colors">
                    <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                  </svg>
                </a>
              )}
              {job.businesses?.cashapp_tag && (
                <a
                  href={`https://cash.app/$${job.businesses.cashapp_tag}/${job.total}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 px-5 py-4 hover:bg-green-50 transition-colors group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#00C244]/10">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#00C244]">
                      <path d="M17.1 8.4l-1.2-1.2-1.5.9c-.7-.4-1.4-.6-2.2-.7L12 6h-1.7l-.2 1.4c-.8.1-1.5.4-2.1.8L6.5 7.3 5.3 8.5l.9 1.5c-.4.7-.6 1.4-.7 2.2L4 12.5v1.7l1.4.2c.1.8.4 1.5.8 2.1l-.9 1.5 1.2 1.2 1.5-.9c.7.4 1.4.6 2.2.7l.2 1.5H12l.2-1.5c.8-.1 1.5-.4 2.1-.8l1.5.9 1.2-1.2-.9-1.5c.4-.7.6-1.4.7-2.1l1.5-.2v-1.7l-1.5-.2c-.1-.8-.4-1.5-.8-2.1l.9-1.6zm-5.4 5.4c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                    </svg>
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-900 text-sm">Pay with Cash App</span>
                    <span className="text-xs text-gray-500">${job.businesses.cashapp_tag} · {formatCurrency(job.total, currency)}</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 group-hover:text-[#00C244] transition-colors">
                    <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                  </svg>
                </a>
              )}
              {job.businesses?.check_payable_to && (
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-500">
                      <path d="M12 7.5h-1.5a2.25 2.25 0 00-2.25 2.25v.75H7.5v-1.5a4.5 4.5 0 019 0v1.5h-2.25v-.75A2.25 2.25 0 0012 7.5z" />
                      <path fillRule="evenodd" d="M1.5 6.375c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v3.026a.75.75 0 01-.375.65 2.249 2.249 0 000 3.898.75.75 0 01.375.65v3.026c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 17.625v-3.026a.75.75 0 01.374-.65 2.249 2.249 0 000-3.898.75.75 0 01-.374-.65V6.375zm15-1.125a.75.75 0 01.75.75v.75a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75zm.75 4.5a.75.75 0 00-1.5 0v.75a.75.75 0 001.5 0v-.75zm-.75 3a.75.75 0 01.75.75v.75a.75.75 0 01-1.5 0v-.75a.75.75 0 01.75-.75zm.75 4.5a.75.75 0 00-1.5 0V18a.75.75 0 001.5 0v-.75zM6 12a.75.75 0 01.75-.75H12a.75.75 0 010 1.5H6.75A.75.75 0 016 12zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-900 text-sm">Pay by Check</span>
                    <span className="text-xs text-gray-500">Make payable to: <span className="font-semibold text-gray-700">{job.businesses?.check_payable_to}</span></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Us */}
        {(job.businesses?.contact_email || job.businesses?.contact_phone) && (
          <div className="mb-8 rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Questions? Contact Us</p>
            </div>
            <div className="flex flex-col divide-y divide-gray-100">
              {job.businesses.contact_email && (
                <a
                  href={`mailto:${job.businesses.contact_email}?subject=${encodeURIComponent(`Question about Invoice ${refNum}`)}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-500">
                      <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                      <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                    </svg>
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-900 text-sm">Email Us</span>
                    <span className="text-xs text-gray-500">{job.businesses.contact_email}</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors">
                    <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                  </svg>
                </a>
              )}
              {job.businesses.contact_phone && (
                <a
                  href={`tel:${job.businesses.contact_phone}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-500">
                      <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-900 text-sm">Call Us</span>
                    <span className="text-xs text-gray-500">{job.businesses.contact_phone}</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors">
                    <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 pt-6 mt-4 text-center">
          <p className="text-xs text-gray-400">
            Powered by{" "}
            <span className="font-bold text-gray-500">HustleBricks</span>
          </p>
        </div>
      </div>
    </div>
  );
}
