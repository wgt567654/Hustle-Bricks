"use client";

import { useState } from "react";

export function EmailInvoiceButton({
  jobId,
  clientEmail,
}: {
  jobId: string;
  clientEmail: string | null | undefined;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!clientEmail) return null;

  async function handleSend() {
    setSending(true);
    try {
      await fetch("/api/email/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={sending}
      className={`print-hidden px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors border ${
        sent
          ? "bg-status-completed/10 text-status-completed border-status-completed/20"
          : "bg-card text-foreground border-border hover:bg-muted/50"
      } ${sending ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      {sending ? "Sending…" : sent ? "✓ Invoice Sent" : "Email Invoice"}
    </button>
  );
}
