import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendSMS } from "./sms";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NotifyOwnerOptions {
  businessId: string;
  subject: string;
  /** Plain-text body; also used as the SMS message. Keep it short. */
  text: string;
}

/**
 * Best-effort owner notification for demand events (new booking request,
 * accepted quote, …). Email sends immediately when RESEND_API_KEY is set;
 * SMS goes through the sms_queue (delivered now if Twilio creds exist,
 * otherwise queued until they do). Never throws — a failed notification
 * must not fail the customer-facing action that triggered it.
 */
export async function notifyOwner({ businessId, subject, text }: NotifyOwnerOptions) {
  try {
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("name, contact_email, contact_phone")
      .eq("id", businessId)
      .single();
    if (!biz) return;

    if (biz.contact_email && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "HustleBricks <notifications@hustlebricks.ai>",
          to: biz.contact_email,
          subject: `${subject} — ${biz.name}`,
          text,
        });
      } catch {
        // email failure is non-fatal
      }
    }

    if (biz.contact_phone) {
      await sendSMS({
        to: biz.contact_phone,
        body: text,
        businessId,
        metadata: { kind: "owner_notification", subject },
      });
    }
  } catch {
    // never let notification errors surface to the caller
  }
}
