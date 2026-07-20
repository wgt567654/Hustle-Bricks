import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SendSMSOptions {
  to: string;
  body: string;
  businessId: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
}

interface SendSMSResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendSMS(opts: SendSMSOptions): Promise<SendSMSResult> {
  const { to, body, businessId, clientId, metadata } = opts;

  const phone = normalizePhone(to);
  if (!phone) {
    return { success: false, error: "Invalid phone number" };
  }

  // Always log to the queue first so nothing is silently lost.
  const { data: queued, error: queueErr } = await supabaseAdmin
    .from("sms_queue")
    .insert({ business_id: businessId, to_phone: phone, body, metadata: metadata ?? null, status: "pending" })
    .select("id")
    .single();

  if (queueErr || !queued) {
    return { success: false, error: queueErr?.message ?? "Failed to queue SMS" };
  }

  const queueId: string = queued.id;

  // If Telnyx credentials are present, send immediately.
  // When you're ready to go live, add these to your .env.local:
  //   TELNYX_API_KEY=KEYxxxx
  //   TELNYX_FROM_NUMBER=+1xxxxxxxxxx
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;

  if (apiKey && fromNumber) {
    try {
      const res = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: fromNumber, to: phone, text: body }),
      });

      if (res.ok) {
        await supabaseAdmin
          .from("sms_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", queueId);
        await logOutbound({ to, body, businessId, clientId, metadata });
        return { success: true, id: queueId };
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg =
        (errData as { errors?: { detail?: string }[] }).errors?.[0]?.detail ??
        `Telnyx error ${res.status}`;
      await supabaseAdmin
        .from("sms_queue")
        .update({ status: "failed", error: errMsg })
        .eq("id", queueId);
      return { success: false, id: queueId, error: errMsg };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      await supabaseAdmin
        .from("sms_queue")
        .update({ status: "failed", error: errMsg })
        .eq("id", queueId);
      return { success: false, id: queueId, error: errMsg };
    }
  }

  // No provider configured — logged to queue, will send when Telnyx is added.
  await supabaseAdmin
    .from("sms_queue")
    .update({ status: "pending" })
    .eq("id", queueId);

  // Still log as outbound so the conversation thread is visible in the inbox.
  await logOutbound({ to, body, businessId, clientId, metadata });

  return { success: true, id: queueId };
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}

async function logOutbound(opts: {
  to: string;
  body: string;
  businessId: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { to, body, businessId, clientId, metadata } = opts;
  const fromNumber = process.env.TELNYX_FROM_NUMBER ?? "system";
  const normalized = normalizePhone(to);

  // Resolve client_id: use explicit id if provided, otherwise look up by phone.
  let resolvedClientId = clientId ?? null;
  if (!resolvedClientId) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("business_id", businessId)
      .eq("phone", normalized ?? to)
      .maybeSingle();
    resolvedClientId = client?.id ?? null;
  }

  await supabaseAdmin.from("sms_messages").insert({
    business_id: businessId,
    client_id:   resolvedClientId,
    direction:   "outbound",
    from_phone:  fromNumber,
    to_phone:    normalized ?? to,
    body,
    read_at:     new Date().toISOString(),
    metadata:    metadata ?? null,
  });
}
