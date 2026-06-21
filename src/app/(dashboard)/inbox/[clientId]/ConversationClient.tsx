"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
  read_at: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ConversationClient({
  clientId,
  initialMessages,
  clientName,
  clientPhone,
  businessId,
}: {
  clientId: string;
  initialMessages: Message[];
  clientName: string;
  clientPhone: string | null;
  businessId: string | null;
}) {
  const router       = useRouter();
  const [messages,   setMessages]   = useState<Message[]>(initialMessages);
  const [bizId]       = useState<string | null>(businessId);
  const [reply,       setReply]       = useState("");
  const [sending,     setSending]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase  = createClient();

  // Supabase Realtime — listen for new messages on this thread
  useEffect(() => {
    if (!bizId) return;
    const channel = supabase
      .channel(`inbox-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sms_messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bizId, clientId, supabase]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!reply.trim() || !bizId || !clientPhone || sending) return;
    setSending(true);
    const text = reply.trim();
    setReply("");

    // Insert outbound message directly (sendSMS is server-only; call a route instead)
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: clientPhone, body: text, businessId: bizId, clientId }),
    });

    if (!res.ok) {
      setReply(text); // restore on failure
    }
    setSending(false);
  }

  // Group messages by day
  const grouped: { day: string; msgs: Message[] }[] = [];
  for (const m of messages) {
    const day = formatDay(m.created_at);
    if (!grouped.length || grouped[grouped.length - 1].day !== day) {
      grouped.push({ day, msgs: [m] });
    } else {
      grouped[grouped.length - 1].msgs.push(m);
    }
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/[0.92] backdrop-blur-[16px] border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex size-8 items-center justify-center rounded-full hover:bg-muted/60 active:scale-90 transition-all text-muted-foreground"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
          {clientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{clientName || "Loading…"}</p>
          {clientPhone && <p className="text-xs text-muted-foreground">{clientPhone}</p>}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            No messages yet. Send your first reply below.
          </div>
        )}

        {grouped.map(({ day, msgs }) => (
          <div key={day} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{day}</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                    m.direction === "outbound"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  <p>{m.body}</p>
                  <p className={`text-[10px] mt-1 ${m.direction === "outbound" ? "text-primary-foreground/60 text-right" : "text-muted-foreground"}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      <div className="sticky bottom-0 border-t border-border/40 bg-background px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex gap-2 items-end">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Reply…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 active:scale-90 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              send
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
