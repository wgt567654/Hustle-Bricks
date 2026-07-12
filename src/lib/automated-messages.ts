import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================================
   Automated message registry — every message the app sends on its own,
   editable per business in Settings → Customize → Message Templates.

   Overrides are stored in message_templates with service_type='*' and
   message_type=<key>. Defaults below are copied VERBATIM from the cron
   routes so behavior is unchanged until a business edits them.
   (The per-service booking SMS templates in lib/messageTemplates.ts are a
   separate, older system and remain untouched.)
   ============================================================================ */

export type AutomatedMessageKey =
  | "review_request"
  | "quote_follow_up_1"
  | "quote_follow_up_2"
  | "quote_follow_up_3"
  | "payment_reminder_1"
  | "payment_reminder_2"
  | "payment_reminder_3"
  | "rebooking";

export type AutomatedMessageDef = {
  key: AutomatedMessageKey;
  label: string;
  group: string;
  channel: "sms" | "email";
  /** when it sends, in plain English */
  timing: string;
  variables: string[];
  defaultBody: string;
};

export const TEMPLATE_VARIABLES: Record<string, string> = {
  CustomerName: "Sarah",
  CompanyName: "BrightView Cleaning",
  AppointmentDate: "July 12",
  AppointmentTime: "9:00 AM",
  ServiceName: "Window Cleaning",
  Technician: "Mike",
  InvoiceAmount: "$245.00",
  InvoiceLink: "https://hustlebricks.com/invoice/…",
  ReviewLink: "https://g.page/r/…",
};

export const AUTOMATED_MESSAGES: AutomatedMessageDef[] = [
  {
    key: "review_request",
    label: "Review request",
    group: "Reviews",
    channel: "sms",
    timing: "After a job is completed",
    variables: ["CustomerName", "CompanyName", "ReviewLink"],
    defaultBody:
      "Hi {{CustomerName}}! This is {{CompanyName}}. We just finished up and hope everything looks great. If we did a good job, would you mind leaving us a quick review? It means the world to us:\n{{ReviewLink}}",
  },
  {
    key: "quote_follow_up_1",
    label: "Quote follow-up · first nudge",
    group: "Quote follow-ups",
    channel: "sms",
    timing: "24 hours after a quote is sent",
    variables: ["CustomerName", "CompanyName"],
    defaultBody:
      "Hi {{CustomerName}}, just checking in on the quote we sent from {{CompanyName}}. Any questions? We're happy to walk you through it!",
  },
  {
    key: "quote_follow_up_2",
    label: "Quote follow-up · second nudge",
    group: "Quote follow-ups",
    channel: "sms",
    timing: "3 days after a quote is sent",
    variables: ["CustomerName", "CompanyName"],
    defaultBody:
      "Hi {{CustomerName}}, {{CompanyName}} here again. Did you get a chance to look over your quote? Let us know if you'd like to adjust anything or move forward!",
  },
  {
    key: "quote_follow_up_3",
    label: "Quote follow-up · final check-in",
    group: "Quote follow-ups",
    channel: "sms",
    timing: "7 days after a quote is sent",
    variables: ["CustomerName", "CompanyName"],
    defaultBody:
      "Hi {{CustomerName}}, last check-in from {{CompanyName}} on your quote. We'd love to earn your business — just reply here or give us a call. Thanks!",
  },
  {
    key: "payment_reminder_1",
    label: "Payment reminder · friendly",
    group: "Payment reminders",
    channel: "sms",
    timing: "3 days after job completion, if unpaid",
    variables: ["CustomerName", "CompanyName", "InvoiceAmount", "InvoiceLink"],
    defaultBody:
      "Hi {{CustomerName}}, just a friendly reminder that your invoice of {{InvoiceAmount}} from {{CompanyName}} is due. Pay anytime here:\n{{InvoiceLink}}",
  },
  {
    key: "payment_reminder_2",
    label: "Payment reminder · outstanding",
    group: "Payment reminders",
    channel: "sms",
    timing: "7 days after job completion, if unpaid",
    variables: ["CustomerName", "CompanyName", "InvoiceAmount", "InvoiceLink"],
    defaultBody:
      "Hi {{CustomerName}}, {{CompanyName}} here — your invoice of {{InvoiceAmount}} is still outstanding. Easy payment options available:\n{{InvoiceLink}}",
  },
  {
    key: "payment_reminder_3",
    label: "Payment reminder · final",
    group: "Payment reminders",
    channel: "sms",
    timing: "14 days after job completion, if unpaid",
    variables: ["CustomerName", "CompanyName", "InvoiceAmount", "InvoiceLink"],
    defaultBody:
      "Hi {{CustomerName}}, final reminder from {{CompanyName}} regarding your balance of {{InvoiceAmount}}. Please pay at your earliest convenience:\n{{InvoiceLink}}",
  },
  {
    key: "rebooking",
    label: "Win-back campaign",
    group: "Marketing",
    channel: "sms",
    timing: "When a customer hasn't booked in a while",
    variables: ["CustomerName", "CompanyName"],
    defaultBody:
      "Hi {{CustomerName}}! It's {{CompanyName}} — it's been a while since your last service. We'd love to have you back! Just reply here and we'll get you scheduled. 😊",
  },
];

/** Replace {{Variable}} placeholders. Unknown variables are left intact. */
export function renderTemplate(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (m, name) => vars[name] ?? m);
}

/**
 * The body a business actually sends for an automated message — their
 * override if saved, otherwise the registry default. Never throws.
 */
export async function getAutomatedTemplate(
  supabase: SupabaseClient,
  businessId: string,
  key: AutomatedMessageKey
): Promise<string> {
  const def = AUTOMATED_MESSAGES.find((m) => m.key === key);
  const fallback = def?.defaultBody ?? "";
  try {
    const { data, error } = await supabase
      .from("message_templates")
      .select("body")
      .eq("business_id", businessId)
      .eq("service_type", "*")
      .eq("message_type", key)
      .maybeSingle();
    if (error || !data?.body) return fallback;
    return data.body;
  } catch {
    return fallback;
  }
}
