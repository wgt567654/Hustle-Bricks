import { createClient } from "@/lib/supabase/server";
import GroupChatClient from "./GroupChatClient";

type GroupMessage = {
  id: string;
  sender_role: "owner" | "employee";
  sender_member_id: string | null;
  content: string;
  created_at: string;
  message_type: string;
  media_url: string | null;
};

type GroupInfo = {
  id: string;
  name: string;
  type: string;
  business_id: string;
  member_count: number;
};

type MemberName = { id: string; name: string };

export default async function OwnerGroupThreadPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let group: GroupInfo | null = null;
  let messages: GroupMessage[] = [];
  let memberNames: Record<string, string> = {};

  if (userId) {
    const { data: business } = await supabase.from("businesses").select("id")
      .eq("owner_id", userId).order("created_at").limit(1).maybeSingle();

    if (business) {
      const [{ data: grp }, { data: membersData }, { data: msgData }] = await Promise.all([
        supabase.from("team_groups").select("id, name, type").eq("id", groupId).eq("business_id", business.id).single(),
        supabase.from("team_group_members").select("team_member_id, team_members(id, name)").eq("group_id", groupId),
        supabase.from("team_group_messages").select("id, sender_role, sender_member_id, content, created_at, message_type, media_url")
          .eq("group_id", groupId).order("created_at", { ascending: true }),
      ]);

      if (grp) {
        const members = (membersData ?? []) as unknown as { team_members: MemberName }[];
        const names: Record<string, string> = {};
        for (const m of members) { if (m.team_members) names[m.team_members.id] = m.team_members.name; }

        group = { id: grp.id, name: grp.name, type: grp.type, business_id: business.id, member_count: members.length };
        memberNames = names;
        messages = (msgData ?? []) as GroupMessage[];
      }
    }
  }

  return (
    <GroupChatClient
      groupId={groupId}
      group={group}
      initialMessages={messages}
      memberNames={memberNames}
    />
  );
}
