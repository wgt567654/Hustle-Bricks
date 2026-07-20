import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { sendSMS } from "@/lib/sms";
import { verifyTelnyxSignature } from "@/lib/telnyx-signature";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Telnyx delivers webhooks as an HTTP POST with a JSON body:
//   { data: { event_type, payload: { from: { phone_number }, to: [{ phone_number }], text, id } } }
// event_type "message.received" is an inbound text; "message.sent"/"message.finalized"
// are delivery receipts we simply acknowledge with 200.
type TelnyxWebhook = {
  data?: {
    event_type?: string;
    payload?: {
      id?: string;
      text?: string;
      from?: { phone_number?: string };
      to?: { phone_number?: string }[];
    };
  };
};

export async function POST(req: NextRequest) {
  // Read the raw body so the signature is verified over the exact bytes sent.
  const rawBody = await req.text();

  // Verify the Ed25519 signature over `${timestamp}|${rawBody}` with Telnyx's
  // public key. Skips gracefully (log-and-continue) when TELNYX_PUBLIC_KEY is unset.
  const valid = verifyTelnyxSignature(
    rawBody,
    req.headers.get("telnyx-signature-ed25519"),
    req.headers.get("telnyx-timestamp")
  );
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let event: TelnyxWebhook;
  try {
    event = JSON.parse(rawBody) as TelnyxWebhook;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const eventType = event.data?.event_type;

  // Delivery-receipt / non-inbound events — acknowledge and no-op.
  if (eventType !== "message.received") {
    return ok();
  }

  const payload = event.data?.payload;
  const fromPhone = payload?.from?.phone_number ?? null;
  const toPhone = payload?.to?.[0]?.phone_number ?? null;
  const body = payload?.text ?? null;
  const messageId = payload?.id ?? null;

  if (!fromPhone || !toPhone || !body) {
    return ok();
  }

  // Find the business that owns this number.
  const telnyxFromEnv = process.env.TELNYX_FROM_NUMBER ?? "";
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, ai_sms_enabled")
    .or(`twilio_number.eq.${toPhone},twilio_number.eq.${telnyxFromEnv}`)
    .limit(1)
    .maybeSingle();

  let businessId: string | null = business?.id ?? null;
  let aiEnabled: boolean = (business as { ai_sms_enabled?: boolean } | null)?.ai_sms_enabled ?? false;
  const bizName: string = (business as { name?: string } | null)?.name ?? "";

  if (!businessId && telnyxFromEnv && toPhone === telnyxFromEnv) {
    const { data: anyBiz } = await supabaseAdmin
      .from("businesses")
      .select("id, name, ai_sms_enabled")
      .limit(1)
      .maybeSingle();
    businessId = anyBiz?.id ?? null;
    aiEnabled = (anyBiz as { ai_sms_enabled?: boolean } | null)?.ai_sms_enabled ?? false;
  }

  if (!businessId) return ok();

  // Find client by their phone number
  const normalized = normalizePhone(fromPhone);
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("phone", normalized ?? fromPhone)
    .maybeSingle();

  // Log inbound message
  await supabaseAdmin.from("sms_messages").insert({
    business_id: businessId,
    client_id:   client?.id ?? null,
    direction:   "inbound",
    from_phone:  fromPhone,
    to_phone:    toPhone,
    body:        body.trim(),
    twilio_sid:  messageId,
    read_at:     null,
  });

  // Always honour STOP/opt-out without AI involvement
  const upperBody = body.trim().toUpperCase();
  if (["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(upperBody)) {
    return ok();
  }

  // AI auto-response if enabled and Anthropic key is present
  if (aiEnabled && process.env.ANTHROPIC_API_KEY && client) {
    await generateAndSendAIReply({
      businessId,
      bizName,
      client: client as { id: string; name: string },
      fromPhone: normalized ?? fromPhone,
      inboundMessage: body.trim(),
    });
  }

  return ok();
}

async function generateAndSendAIReply({
  businessId,
  bizName,
  client,
  fromPhone,
  inboundMessage,
}: {
  businessId: string;
  bizName: string;
  client: { id: string; name: string };
  fromPhone: string;
  inboundMessage: string;
}) {
  // Gather context: upcoming jobs and recent conversation
  const now = new Date().toISOString();
  const sevenDaysAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const [{ data: upcomingJobs }, { data: recentMessages }] = await Promise.all([
    supabaseAdmin
      .from("jobs")
      .select("id, status, total, scheduled_at, service_type, notes")
      .eq("business_id", businessId)
      .eq("client_id", client.id)
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", now)
      .lte("scheduled_at", sevenDaysAhead)
      .order("scheduled_at", { ascending: true })
      .limit(3),
    supabaseAdmin
      .from("sms_messages")
      .select("direction, body, created_at")
      .eq("business_id", businessId)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  type JobContext = { id: string; status: string; total: number; scheduled_at: string | null; service_type: string | null; notes: string | null };
  type MsgContext = { direction: string; body: string; created_at: string };

  const jobs = (upcomingJobs as unknown as JobContext[]) ?? [];
  const messages = ((recentMessages as unknown as MsgContext[]) ?? []).reverse();

  const jobsSummary = jobs.length
    ? jobs.map((j) => {
        const time = j.scheduled_at
          ? new Date(j.scheduled_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
          : "TBD";
        return `- ${j.service_type ?? "Service"} on ${time} (status: ${j.status})`;
      }).join("\n")
    : "No upcoming jobs scheduled.";

  const conversationHistory = messages.map((m) => ({
    role: (m.direction === "outbound" ? "assistant" : "user") as "user" | "assistant",
    content: m.body,
  }));

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt =
    `You are a friendly, professional assistant for ${bizName}, a home services business. ` +
    `You are texting with ${client.name}. Keep replies SHORT (1-3 sentences max) and conversational — this is SMS. ` +
    `Never make up information. If you don't know something (like exact pricing), say you'll have the owner follow up. ` +
    `If they want to reschedule or cancel, tell them you'll pass it along and someone will confirm. ` +
    `Do not mention you are an AI.\n\n` +
    `Client's upcoming jobs:\n${jobsSummary}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        { role: "user", content: inboundMessage },
      ],
    });

    const replyText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join(" ")
      .trim();

    if (replyText) {
      await sendSMS({
        to: fromPhone,
        body: replyText,
        businessId,
        clientId: client.id,
        metadata: { type: "ai_sms_reply" },
      });
    }
  } catch (err) {
    console.error("[sms-webhook] AI reply error:", err);
    // Fail silently — the inbound message is already logged, owner sees it in inbox
  }
}

function ok() {
  return NextResponse.json({ received: true }, { status: 200 });
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}
