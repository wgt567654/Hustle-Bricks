import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/supabase/get-business";
import ConversationClient from "./ConversationClient";

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
  read_at: string | null;
};

export default async function InboxThreadPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const businessId = await getBusinessId(supabase);

  let messages: Message[] = [];
  let clientName = "";
  let clientPhone: string | null = null;

  if (businessId) {
    const { data: client } = await supabase
      .from("clients")
      .select("name, phone")
      .eq("id", clientId)
      .single();

    if (client) {
      clientName = (client as { name: string; phone: string | null }).name;
      clientPhone = (client as { name: string; phone: string | null }).phone;
    }

    const { data: msgs } = await supabase
      .from("sms_messages")
      .select("id, direction, body, created_at, read_at")
      .eq("business_id", businessId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (msgs) messages = msgs as Message[];

    // Mark all unread inbound as read
    await supabase
      .from("sms_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .eq("client_id", clientId)
      .eq("direction", "inbound")
      .is("read_at", null);
  }

  return (
    <ConversationClient
      clientId={clientId}
      initialMessages={messages}
      clientName={clientName}
      clientPhone={clientPhone}
      businessId={businessId}
    />
  );
}
