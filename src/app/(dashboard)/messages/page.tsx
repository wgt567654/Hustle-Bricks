import { createClient } from "@/lib/supabase/server";
import MessagesClient from "./MessagesClient";

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

export default async function MessagesPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let members: MemberRow[] = [];
  const lastMessages: Record<string, LastMessage> = {};
  const unreadCounts: Record<string, number> = {};
  let businessId: string | null = null;
  let lastBroadcast: Broadcast | null = null;
  let groups: Group[] = [];

  if (userId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (business) {
      businessId = business.id;

      const [{ data: membersData }, { data: messagesData }, { data: broadcastData }, { data: groupsData }, { data: groupMsgData }] = await Promise.all([
        supabase.from("team_members")
          .select("id, name, role, user_id")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("name"),
        supabase.from("team_messages")
          .select("team_member_id, content, sender_role, created_at, message_type, is_read")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false }),
        supabase.from("team_broadcasts")
          .select("id, content, created_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("team_groups").select("id, name, type, team_group_members(team_member_id)")
          .eq("business_id", business.id)
          .order("created_at"),
        supabase.from("team_group_messages").select("group_id, content, message_type, created_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false }),
      ]);

      members = (membersData ?? []) as MemberRow[];

      for (const msg of (messagesData ?? []) as LastMessage[]) {
        if (!lastMessages[msg.team_member_id]) {
          lastMessages[msg.team_member_id] = msg;
        }
        if (msg.sender_role === "employee" && !msg.is_read) {
          unreadCounts[msg.team_member_id] = (unreadCounts[msg.team_member_id] ?? 0) + 1;
        }
      }

      lastBroadcast = (broadcastData as Broadcast | null) ?? null;

      // Reduce group messages to latest per group
      const latestGroupMsg: Record<string, { content: string; message_type: string; created_at: string }> = {};
      for (const gm of (groupMsgData ?? []) as { group_id: string; content: string; message_type: string; created_at: string }[]) {
        if (!latestGroupMsg[gm.group_id]) latestGroupMsg[gm.group_id] = gm;
      }
      groups = ((groupsData ?? []) as unknown as { id: string; name: string; type: string; team_group_members: { team_member_id: string }[] }[]).map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        member_count: g.team_group_members?.length ?? 0,
        last_message: latestGroupMsg[g.id]?.content ?? null,
        last_message_at: latestGroupMsg[g.id]?.created_at ?? null,
      }));
    }
  }

  return (
    <MessagesClient
      initialMembers={members}
      initialLastMessages={lastMessages}
      initialUnreadCounts={unreadCounts}
      initialBusinessId={businessId}
      initialLastBroadcast={lastBroadcast}
      initialGroups={groups}
    />
  );
}
