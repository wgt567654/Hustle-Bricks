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
      className="print-hidden"
      style={{
        padding: "10px 20px",
        borderRadius: 10,
        border: "1px solid #d1d5db",
        background: sent ? "#dcfce7" : "white",
        color: sent ? "#16a34a" : "#374151",
        fontWeight: 700,
        fontSize: 13,
        cursor: sending ? "not-allowed" : "pointer",
        opacity: sending ? 0.6 : 1,
      }}
    >
      {sending ? "Sending…" : sent ? "✓ Invoice Sent" : "Email Invoice"}
    </button>
  );
}
