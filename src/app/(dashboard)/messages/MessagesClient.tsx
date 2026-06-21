"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MemberRow = {
  id: string;
  name: string;
  role: string;
  user_id: string | null;
};

type LastMessage = {
  team_member_id: string;
  content: string;
  sender_role: "owner" | "employee";
  created_at: string;
  message_type: string;
  is_read: boolean;
};

type Broadcast = {
  id: string;
  content: string;
  created_at: string;
};

type Group = {
  id: string;
  name: string;
  type: string;
  member_count: number;
  last_message: string | null;
  last_message_at: string | null;
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function messagePreview(msg: LastMessage, isOwner: boolean): string {
  const prefix = isOwner ? "You: " : "";
  if (msg.message_type === "photo") return prefix + "📷 Photo";
  if (msg.message_type === "voice") return prefix + "🎤 Voice message";
  if (msg.message_type === "job_card") return prefix + "🔧 Job shared";
  if (msg.message_type === "lead_card") return "📍 New lead shared";
  if (msg.message_type === "commission_summary") return prefix + "📊 Commission summary";
  if (msg.message_type === "schedule_share") return "📅 Schedule shared";
  return prefix + msg.content;
}

const ROLE_LABELS: Record<string, string> = { admin: "Admin", member: "Member", sales: "Sales" };

export default function MessagesClient({
  initialMembers,
  initialLastMessages,
  initialUnreadCounts,
  initialBusinessId,
  initialLastBroadcast,
  initialGroups,
}: {
  initialMembers: MemberRow[];
  initialLastMessages: Record<string, LastMessage>;
  initialUnreadCounts: Record<string, number>;
  initialBusinessId: string | null;
  initialLastBroadcast: Broadcast | null;
  initialGroups: Group[];
}) {
  const router = useRouter();
  const [members] = useState<MemberRow[]>(initialMembers);
  const [lastMessages] = useState<Record<string, LastMessage>>(initialLastMessages);
  const [unreadCounts] = useState<Record<string, number>>(initialUnreadCounts);
  const [businessId] = useState<string | null>(initialBusinessId);
  const [lastBroadcast, setLastBroadcast] = useState<Broadcast | null>(initialLastBroadcast);
  const [showBroadcastSheet, setShowBroadcastSheet] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [showNewGroupSheet, setShowNewGroupSheet] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<"custom" | "territory">("custom");
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  async function sendBroadcast() {
    if (!businessId || !broadcastText.trim() || sendingBroadcast) return;
    setSendingBroadcast(true);
    const supabase = createClient();
    await supabase.from("team_broadcasts").insert({
      business_id: businessId,
      content: broadcastText.trim(),
    });
    const text = broadcastText.trim();
    setLastBroadcast({ id: crypto.randomUUID(), content: text, created_at: new Date().toISOString() });
    setBroadcastText("");
    setSendingBroadcast(false);
    setBroadcastSent(true);
    setTimeout(() => {
      setBroadcastSent(false);
      setShowBroadcastSheet(false);
    }, 1800);
  }

  async function createGroup() {
    if (!businessId || !newGroupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    const supabase = createClient();

    let memberIds = newGroupMembers;
    if (newGroupType === "territory") {
      // Auto-populate from territory_assignments for selected members, or all members if none selected
      memberIds = members.map((m) => m.id);
    }
    if (memberIds.length === 0) memberIds = members.map((m) => m.id);

    const { data: grp, error } = await supabase.from("team_groups")
      .insert({ business_id: businessId, name: newGroupName.trim(), type: newGroupType })
      .select("id").single();

    if (!error && grp) {
      if (memberIds.length > 0) {
        await supabase.from("team_group_members").insert(memberIds.map((id) => ({ group_id: grp.id, team_member_id: id })));
      }
      setGroups((prev) => [...prev, { id: grp.id, name: newGroupName.trim(), type: newGroupType, member_count: memberIds.length, last_message: null, last_message_at: null }]);
      setNewGroupName("");
      setNewGroupType("custom");
      setNewGroupMembers([]);
      setShowNewGroupSheet(false);
      router.push(`/messages/groups/${grp.id}`);
    }
    setCreatingGroup(false);
  }

  const sorted = [...members].sort((a, b) => {
    const aUnread = (unreadCounts[a.id] ?? 0) > 0;
    const bUnread = (unreadCounts[b.id] ?? 0) > 0;
    if (aUnread && !bUnread) return -1;
    if (!aUnread && bUnread) return 1;
    const aMsg = lastMessages[a.id];
    const bMsg = lastMessages[b.id];
    if (aMsg && bMsg) return new Date(bMsg.created_at).getTime() - new Date(aMsg.created_at).getTime();
    if (aMsg) return -1;
    if (bMsg) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col max-w-xl mx-auto">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border/50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Team Chat</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Message your crew</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewGroupSheet(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">group_add</span>
              Group
            </button>
            <button
              onClick={() => setShowBroadcastSheet(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">campaign</span>
              Broadcast
            </button>
          </div>
        </div>
      </div>

      {/* Last broadcast preview */}
      {lastBroadcast && (
        <div className="mx-4 mt-3 mb-1 px-3.5 py-2.5 rounded-2xl bg-muted/60 border border-border/40 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[18px] text-primary mt-0.5 shrink-0">campaign</span>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Last broadcast</span>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgo(lastBroadcast.created_at)}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{lastBroadcast.content}</p>
          </div>
        </div>
      )}

      {members.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-center px-8">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">group</span>
          <p className="text-sm font-semibold text-muted-foreground">No team members yet</p>
          <p className="text-xs text-muted-foreground/60">Add team members from the Team page to start messaging them.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="flex flex-col divide-y divide-border/40 mt-2">
          {sorted.map((member) => {
            const last = lastMessages[member.id];
            const unread = unreadCounts[member.id] ?? 0;
            const hasUnread = unread > 0;
            return (
              <button
                key={member.id}
                onClick={() => router.push(`/messages/${member.id}`)}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left w-full"
              >
                <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-extrabold text-sm">
                  {getInitials(member.name)}
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm leading-snug truncate ${hasUnread ? "font-extrabold text-foreground" : "font-bold text-foreground"}`}>
                      {member.name}
                    </span>
                    {last && (
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgo(last.created_at)}</span>
                    )}
                  </div>
                  {last ? (
                    <span className={`text-xs truncate ${hasUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {messagePreview(last, last.sender_role === "owner")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">No messages yet</span>
                  )}
                  <span className="text-[10px] text-muted-foreground/40">{ROLE_LABELS[member.role] ?? member.role}</span>
                </div>
                <span className="material-symbols-outlined text-muted-foreground/30 text-[16px] shrink-0">chevron_right</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Groups section */}
      {groups.length > 0 && (
        <div className="mt-2">
          <div className="px-4 py-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Groups</span>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {groups.map((grp) => (
              <button
                key={grp.id}
                onClick={() => router.push(`/messages/groups/${grp.id}`)}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left w-full"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <span className="material-symbols-outlined text-[20px]">{grp.type === "territory" ? "pin_drop" : "group"}</span>
                </div>
                <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-sm text-foreground truncate">{grp.name}</span>
                    {grp.last_message_at && (
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgo(grp.last_message_at)}</span>
                    )}
                  </div>
                  {grp.last_message ? (
                    <span className="text-xs text-muted-foreground truncate">{grp.last_message}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">No messages yet</span>
                  )}
                  <span className="text-[10px] text-muted-foreground/40">{grp.member_count} member{grp.member_count !== 1 ? "s" : ""}</span>
                </div>
                <span className="material-symbols-outlined text-muted-foreground/30 text-[16px] shrink-0">chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Broadcast sheet */}
      {showBroadcastSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBroadcastSheet(false)} />
          <div className="relative bg-background rounded-t-3xl p-5 flex flex-col gap-4 max-w-xl w-full mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-base text-foreground">Broadcast to Team</h2>
                <p className="text-xs text-muted-foreground mt-0.5">All active team members will receive this message</p>
              </div>
              <button onClick={() => setShowBroadcastSheet(false)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {broadcastSent ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <span className="material-symbols-outlined text-[40px] text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="text-sm font-semibold text-foreground">Broadcast sent!</p>
                <p className="text-xs text-muted-foreground">All {members.length} team members received your message</p>
              </div>
            ) : (
              <>
                <textarea
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Type your message to the whole team…"
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={sendBroadcast}
                  disabled={!broadcastText.trim() || sendingBroadcast}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-40 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">campaign</span>
                  {sendingBroadcast ? "Sending…" : `Send to all ${members.length} members`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* New Group sheet */}
      {showNewGroupSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewGroupSheet(false)} />
          <div className="relative bg-background rounded-t-3xl p-5 flex flex-col gap-4 max-w-xl w-full mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base text-foreground">New Group</h2>
              <button onClick={() => setShowNewGroupSheet(false)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Group name</label>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. North Territory, Window Crew"
                className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Type</label>
              <div className="flex gap-2">
                {(["custom", "territory"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewGroupType(t)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${newGroupType === t ? "bg-primary/10 border-primary text-primary" : "bg-muted/40 border-border text-muted-foreground"}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{t === "territory" ? "pin_drop" : "group"}</span>
                    {t === "territory" ? "Territory" : "Custom"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground/60 mt-1.5">
                {newGroupType === "territory" ? "Auto-includes all active team members" : "Choose which members to include below"}
              </p>
            </div>
            {newGroupType === "custom" && members.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">Members</label>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {members.map((m) => {
                    const selected = newGroupMembers.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => setNewGroupMembers(selected ? newGroupMembers.filter((id) => id !== m.id) : [...newGroupMembers, m.id])}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${selected ? "bg-primary/10 border-primary" : "bg-muted/40 border-border"}`}
                      >
                        <div className={`flex size-6 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-border"}`}>
                          {selected && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                        </div>
                        <span className="text-sm font-medium text-foreground">{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              onClick={createGroup}
              disabled={!newGroupName.trim() || creatingGroup || (newGroupType === "custom" && newGroupMembers.length === 0)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-40 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">group_add</span>
              {creatingGroup ? "Creating…" : "Create Group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
