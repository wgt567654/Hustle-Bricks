"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function CheckoutForm({
  jobId,
  amount,
  onSuccess,
}: {
  jobId: string;
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    // Get client secret
    const res = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    const { clientSecret, error: serverError } = await res.json();
    if (serverError || !clientSecret) {
      setError(serverError ?? "Could not create payment");
      setSubmitting(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      // Record payment in DB
      await fetch("/api/stripe/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id, jobId }),
      });
      onSuccess();
    }

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || !stripe}
        className="w-full py-3 rounded-xl bg-[#635bff] text-white font-bold text-sm hover:bg-[#5a52e8] disabled:opacity-50 transition-colors"
      >
        {submitting ? "Processing…" : `Pay $${amount.toFixed(2)}`}
      </button>
    </form>
  );
}

export function StripePaymentForm({
  jobId,
  amount,
}: {
  jobId: string;
  amount: number;
}) {
  const [open, setOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  const [options] = useState({
    mode: "payment" as const,
    amount: Math.round(amount * 100),
    currency: "usd",
    appearance: {
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#635bff",
        borderRadius: "12px",
      },
    },
  });

  if (paid) {
    return (
      <div className="flex items-center gap-4 px-5 py-4 bg-green-50">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-600">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-green-800 text-sm">Payment successful!</p>
          <p className="text-xs text-green-700">Reload the page to see the updated invoice.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-4 px-5 py-4 hover:bg-indigo-50 transition-colors group"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#635bff]/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#635bff]">
              <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
              <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex flex-col flex-1 text-left">
            <span className="font-bold text-gray-900 text-sm">Pay by Card</span>
            <span className="text-xs text-gray-500">${amount.toFixed(2)} · Secured by Stripe</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 group-hover:text-[#635bff] transition-colors">
            <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
          </svg>
        </button>
      ) : (
        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Pay by Card</span>
            <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm jobId={jobId} amount={amount} onSuccess={() => setPaid(true)} />
          </Elements>
          <p className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-gray-400">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            Payments secured by Stripe
          </p>
        </div>
      )}
    </div>
  );
}
