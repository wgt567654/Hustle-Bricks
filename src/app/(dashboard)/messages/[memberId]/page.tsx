import { createClient } from "@/lib/supabase/server";
import MemberChatClient from "./MemberChatClient";

type Message = {
  id: string;
  sender_role: "owner" | "employee";
  content: string;
  created_at: string;
  message_type: string;
  metadata: Record<string, unknown> | null;
  media_url: string | null;
  is_read: boolean;
};

type MemberInfo = {
  id: string;
  name: string;
  role: string;
  business_id: string;
  commission_rate: number | null;
};

export default async function MemberThreadPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let member: MemberInfo | null = null;
  let messages: Message[] = [];

  if (userId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id, commission_rate")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (business) {
      const { data: tm } = await supabase
        .from("team_members")
        .select("id, name, role, commission_rate")
        .eq("id", memberId)
        .eq("business_id", business.id)
        .single();

      if (tm) {
        member = {
          id: tm.id,
          name: tm.name,
          role: tm.role,
          business_id: business.id,
          commission_rate: (tm as unknown as { commission_rate: number | null }).commission_rate
            ?? (business as unknown as { commission_rate: number | null }).commission_rate,
        };

        const { data } = await supabase
          .from("team_messages")
          .select("id, sender_role, content, created_at, message_type, metadata, media_url, is_read")
          .eq("team_member_id", memberId)
          .order("created_at", { ascending: true });

        messages = (data ?? []) as Message[];

        // Mark employee messages as read
        await supabase.from("team_messages")
          .update({ is_read: true })
          .eq("team_member_id", memberId)
          .eq("sender_role", "employee")
          .eq("is_read", false);
      }
    }
  }

  return (
    <MemberChatClient
      memberId={memberId}
      initialMember={member}
      initialMessages={messages}
    />
  );
}
