import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";

type Conversation = {
  client_id: string;
  client_name: string;
  last_body: string;
  last_at: string;
  unread: number;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function InboxPage() {
  const supabase = await createClient();
  const bizId = await getBusinessId(supabase);

  let convos: Conversation[] = [];

  if (bizId) {
    // Fetch all messages for this business with client info
    const { data: messages } = await supabase
      .from("sms_messages")
      .select("client_id, body, direction, read_at, created_at, clients(name)")
      .eq("business_id", bizId)
      .not("client_id", "is", null)
      .order("created_at", { ascending: false });

    if (messages) {
      type MsgRow = {
        client_id: string;
        body: string;
        direction: string;
        read_at: string | null;
        created_at: string;
        clients: { name: string } | null;
      };

      // Group by client — keep most recent message per client
      const map = new Map<string, Conversation>();
      for (const m of messages as unknown as MsgRow[]) {
        if (!m.client_id) continue;
        if (!map.has(m.client_id)) {
          map.set(m.client_id, {
            client_id:   m.client_id,
            client_name: m.clients?.name ?? "Unknown",
            last_body:   m.body,
            last_at:     m.created_at,
            unread:      0,
          });
        }
        const c = map.get(m.client_id)!;
        if (m.direction === "inbound" && !m.read_at) {
          c.unread++;
        }
      }

      convos = Array.from(map.values());
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Messaging</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
          Inbox
        </h1>
      </div>

      {convos.length === 0 && (
        <Card className="p-8 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-[40px] text-muted-foreground/30" style={{ fontVariationSettings: "'FILL' 1" }}>
            chat_bubble
          </span>
          <p className="font-semibold text-foreground">No conversations yet</p>
          <p className="text-sm text-muted-foreground">
            When clients reply to your SMS messages they&apos;ll appear here.
          </p>
        </Card>
      )}

      {convos.length > 0 && (
        <Card className="divide-y divide-border/40 overflow-hidden p-0">
          {convos.map((c) => (
            <Link
              key={c.client_id}
              href={`/inbox/${c.client_id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors active:bg-muted/60"
            >
              {/* Avatar */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                {c.client_name.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold truncate ${c.unread > 0 ? "text-foreground" : "text-foreground/80"}`}>
                    {c.client_name}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(c.last_at)}</span>
                </div>
                <p className={`text-sm truncate mt-0.5 ${c.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {c.last_body}
                </p>
              </div>

              {c.unread > 0 && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold tabular-nums">
                  {c.unread}
                </span>
              )}
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
