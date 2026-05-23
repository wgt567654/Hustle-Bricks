import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getBusinessId } from "@/lib/supabase/get-business";
import Anthropic from "@anthropic-ai/sdk";
import { sendSMS } from "@/lib/sms";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_todays_jobs",
    description: "Get all jobs scheduled for today with client names, status, and total. Use to answer questions about today's schedule.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_pending_quotes",
    description: "Get quotes that have been sent to clients but not yet accepted or declined.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_unpaid_invoices",
    description: "Get completed jobs that have not been paid yet, with client names and amounts owed.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_revenue_summary",
    description: "Get total revenue collected for a time period.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: {
          type: "string",
          enum: ["today", "this_week", "this_month", "last_month", "this_year"],
          description: "The time period to summarize.",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "search_clients",
    description: "Search for clients by name. Returns matching clients with their contact info and job history summary.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Client name or partial name to search for." },
      },
      required: ["name"],
    },
  },
  {
    name: "get_upcoming_jobs",
    description: "Get all scheduled jobs in the next N days.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days ahead to look. Defaults to 7." },
      },
      required: [],
    },
  },
  {
    name: "send_client_sms",
    description: "Send an SMS text message to a specific client. Always confirm the message content before sending by including it in your response first.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_id: { type: "string", description: "The client's ID." },
        message: { type: "string", description: "The SMS message text to send." },
      },
      required: ["client_id", "message"],
    },
  },
  {
    name: "update_job_status",
    description: "Update the status of a job (e.g. mark as completed, in_progress, or cancelled).",
    input_schema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string", description: "The job's ID." },
        status: {
          type: "string",
          enum: ["scheduled", "in_progress", "completed", "cancelled"],
          description: "The new status.",
        },
      },
      required: ["job_id", "status"],
    },
  },
  {
    name: "send_job_invoice",
    description: "Send the invoice for a completed job to the client via SMS and email.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string", description: "The job's ID to send the invoice for." },
      },
      required: ["job_id"],
    },
  },
];

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  businessId: string
): Promise<string> {
  const now = new Date();

  switch (toolName) {
    case "get_todays_jobs": {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      const { data } = await supabaseAdmin
        .from("jobs")
        .select("id, status, total, scheduled_at, service_type, notes, clients(name, phone, address)")
        .eq("business_id", businessId)
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at");
      if (!data?.length) return "No jobs scheduled for today.";
      type JobRow = { id: string; status: string; total: number; scheduled_at: string | null; service_type: string | null; notes: string | null; clients: { name: string; phone: string | null; address: string | null } | null };
      return (data as unknown as JobRow[]).map((j) => {
        const time = j.scheduled_at ? new Date(j.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "No time";
        return `• ${time} — ${j.clients?.name ?? "Unknown"} | ${j.service_type ?? j.notes ?? "Service"} | $${j.total} | Status: ${j.status} | ID: ${j.id}`;
      }).join("\n");
    }

    case "get_pending_quotes": {
      const { data } = await supabaseAdmin
        .from("quotes")
        .select("id, total, created_at, sent_at, clients(name, phone)")
        .eq("business_id", businessId)
        .eq("status", "sent")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false });
      if (!data?.length) return "No pending quotes awaiting response.";
      type QuoteRow = { id: string; total: number; created_at: string; sent_at: string | null; clients: { name: string; phone: string | null } | null };
      return (data as unknown as QuoteRow[]).map((q) => {
        const sentDays = q.sent_at ? Math.floor((now.getTime() - new Date(q.sent_at).getTime()) / 86_400_000) : "?";
        return `• ${q.clients?.name ?? "Unknown"} — $${q.total} — sent ${sentDays}d ago | ID: ${q.id}`;
      }).join("\n");
    }

    case "get_unpaid_invoices": {
      const { data } = await supabaseAdmin
        .from("jobs")
        .select("id, total, completed_at, clients(id, name, phone), payments(status)")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .not("completed_at", "is", null);
      type JobRow = { id: string; total: number; completed_at: string; clients: { id: string; name: string; phone: string | null } | null; payments: { status: string }[] };
      const unpaid = ((data as unknown as JobRow[]) ?? []).filter((j) => !j.payments?.some((p) => p.status === "paid"));
      if (!unpaid.length) return "No unpaid invoices. All completed jobs have been paid.";
      const total = unpaid.reduce((s, j) => s + j.total, 0);
      const lines = unpaid.map((j) => {
        const days = Math.floor((now.getTime() - new Date(j.completed_at).getTime()) / 86_400_000);
        return `• ${j.clients?.name ?? "Unknown"} — $${j.total} — completed ${days}d ago | Job ID: ${j.id} | Client ID: ${j.clients?.id ?? ""}`;
      });
      return `Total outstanding: $${total.toFixed(2)}\n${lines.join("\n")}`;
    }

    case "get_revenue_summary": {
      const period = input.period as string;
      let start: Date, end: Date = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      if (period === "today") { start = new Date(now); start.setHours(0, 0, 0, 0); }
      else if (period === "this_week") { start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); }
      else if (period === "this_month") { start = new Date(y, m, 1); }
      else if (period === "last_month") { start = new Date(y, m - 1, 1); end = new Date(y, m, 0, 23, 59, 59); }
      else { start = new Date(y, 0, 1); }
      const { data } = await supabaseAdmin
        .from("payments")
        .select("amount")
        .eq("business_id", businessId)
        .eq("status", "paid")
        .gte("paid_at", start.toISOString())
        .lte("paid_at", end.toISOString());
      const total = ((data ?? []) as { amount: number }[]).reduce((s, p) => s + p.amount, 0);
      const count = data?.length ?? 0;
      return `Revenue for ${period}: $${total.toFixed(2)} from ${count} payment${count !== 1 ? "s" : ""}.`;
    }

    case "search_clients": {
      const name = input.name as string;
      const { data } = await supabaseAdmin
        .from("clients")
        .select("id, name, phone, email, address, jobs(id, status, total, completed_at)")
        .eq("business_id", businessId)
        .ilike("name", `%${name}%`)
        .limit(5);
      if (!data?.length) return `No clients found matching "${name}".`;
      type ClientRow = { id: string; name: string; phone: string | null; email: string | null; address: string | null; jobs: { id: string; status: string; total: number }[] };
      return (data as unknown as ClientRow[]).map((c) => {
        const jobCount = c.jobs?.length ?? 0;
        const totalSpent = (c.jobs ?? []).reduce((s, j) => s + j.total, 0);
        return `• ${c.name} | Phone: ${c.phone ?? "none"} | Email: ${c.email ?? "none"} | ${jobCount} job(s), $${totalSpent.toFixed(2)} total | Client ID: ${c.id}`;
      }).join("\n");
    }

    case "get_upcoming_jobs": {
      const days = (input.days as number) ?? 7;
      const end = new Date(now.getTime() + days * 86_400_000);
      const { data } = await supabaseAdmin
        .from("jobs")
        .select("id, status, total, scheduled_at, service_type, notes, clients(name, phone)")
        .eq("business_id", businessId)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", end.toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at");
      if (!data?.length) return `No jobs scheduled in the next ${days} days.`;
      type JobRow = { id: string; status: string; total: number; scheduled_at: string | null; service_type: string | null; notes: string | null; clients: { name: string; phone: string | null } | null };
      return (data as unknown as JobRow[]).map((j) => {
        const dt = j.scheduled_at ? new Date(j.scheduled_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No time";
        return `• ${dt} — ${j.clients?.name ?? "Unknown"} | ${j.service_type ?? j.notes ?? "Service"} | $${j.total} | ID: ${j.id}`;
      }).join("\n");
    }

    case "send_client_sms": {
      const clientId = input.client_id as string;
      const message = input.message as string;
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id, name, phone")
        .eq("id", clientId)
        .eq("business_id", businessId)
        .single();
      if (!client || !(client as { phone: string | null }).phone) return "Client not found or has no phone number.";
      const c = client as { id: string; name: string; phone: string };
      const result = await sendSMS({
        to: c.phone,
        body: message,
        businessId,
        clientId: c.id,
        metadata: { type: "assistant_sms" },
      });
      return result.id ? `SMS sent to ${c.name} (${c.phone}).` : `Failed to send SMS: ${result.error ?? "unknown error"}`;
    }

    case "update_job_status": {
      const jobId = input.job_id as string;
      const status = input.status as string;
      const updates: Record<string, unknown> = { status };
      if (status === "completed") updates.completed_at = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("jobs")
        .update(updates)
        .eq("id", jobId)
        .eq("business_id", businessId);
      if (error) return `Failed to update job: ${error.message}`;
      if (status === "completed") {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/invoice/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        }).catch(() => {});
      }
      return `Job ${jobId} status updated to "${status}".${status === "completed" ? " Invoice notification will be sent to the client." : ""}`;
    }

    case "send_job_invoice": {
      const jobId = input.job_id as string;
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/invoice/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.skipped) return `Invoice not sent: ${json.reason === "already_sent" ? "already sent previously" : json.reason}.`;
      if (!res.ok) return `Failed to send invoice: ${JSON.stringify(json)}`;
      return `Invoice sent to the client via SMS and email.`;
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getBusinessId(supabase);
  if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

  const { message, history = [] } = await req.json() as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const today = new Date().toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const systemPrompt =
    `You are a business operations assistant for a home services company using HustleBricks. ` +
    `Today is ${today}. You have access to tools to query business data and take actions. ` +
    `Be concise. When showing lists, use bullet points. Format currency as $X.XX. ` +
    `Before sending any SMS, always show the exact message text in your response so the user can see what was sent. ` +
    `When asked to do something you can't do with your tools, say so clearly.`;

  // Agentic loop — keep going until Claude stops calling tools (max 5 rounds)
  let response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  });

  let rounds = 0;
  while (response.stop_reason === "tool_use" && rounds < 5) {
    rounds++;
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input as Record<string, unknown>, businessId),
      }))
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
  }

  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return NextResponse.json({ reply });
}
