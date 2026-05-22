"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_role: "owner" | "employee";
  content: string;
  created_at: string;
};

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function EmployeeMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notApproved, setNotApproved] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id, business_id, is_active")
        .eq("user_id", user.id)
        .single();
      if (!tm) {
        setLoading(false);
        return;
      }
      if (!(tm as unknown as { is_active: boolean }).is_active) {
        setNotApproved(true);
        setLoading(false);
        return;
      }
      setTeamMemberId(tm.id);
      setBusinessId((tm as unknown as { business_id: string }).business_id);

      const { data } = await supabase
        .from("team_messages")
        .select("id, sender_role, content, created_at")
        .eq("team_member_id", tm.id)
        .order("created_at", { ascending: true });
      setMessages((data ?? []) as Message[]);
      setLoading(false);

      // Realtime subscription
      supabase
        .channel(`team-messages-${tm.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "team_messages", filter: `team_member_id=eq.${tm.id}` },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        )
        .subscribe();
    }
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!teamMemberId || !businessId || !text.trim() || sending) return;
    setSending(true);
    const supabase = createClient();
    const content = text.trim();
    setText("");
    await supabase.from("team_messages").insert({
      team_member_id: teamMemberId,
      business_id: businessId,
      sender_role: "employee",
      content,
    });
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100svh-3.5rem-env(safe-area-inset-bottom,0px)-3.75rem)] max-w-xl mx-auto">

      {/* Header */}
      <div className="px-4 py-4 border-b border-border/50 shrink-0">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Messages</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Direct line to your manager</p>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
        )}

        {!loading && notApproved && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">pending</span>
            <p className="text-sm font-semibold text-muted-foreground">Approval pending</p>
            <p className="text-xs text-muted-foreground/60">Messaging will be available once your manager approves your account.</p>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">chat</span>
            <p className="text-sm font-semibold text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60">Send a message to your manager below</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_role === "employee";
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground/50 px-1">
                  {isMe ? "You" : "Manager"} · {formatMsgTime(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/50 shrink-0 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message your manager…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32 overflow-y-auto"
          style={{ lineHeight: "1.5" }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending || notApproved}
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white disabled:opacity-40 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            send
          </span>
        </button>
      </div>
    </div>
  );
}
