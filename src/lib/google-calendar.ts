import { createClient } from "@/lib/supabase/server";

const GCAL_BASE = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type TokenRow = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_id: string | null;
};

export type JobForCalendar = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
};

/** Convert a UUID to a valid Google Calendar event ID (alphanumeric, no hyphens). */
function jobIdToEventId(jobId: string): string {
  return jobId.replace(/-/g, "");
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh Google access token");
  return res.json();
}

/** Returns a valid access token and calendar ID, refreshing if needed. Returns null if not connected. */
export async function getValidTokens(
  businessId: string
): Promise<{ accessToken: string; calendarId: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expires_at, calendar_id")
    .eq("business_id", businessId)
    .single();

  if (!data) return null;

  const row = data as TokenRow;
  const expiresAt = new Date(row.expires_at);

  // Refresh if expiring within 5 minutes
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(row.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();

    await supabase
      .from("google_calendar_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);

    return {
      accessToken: refreshed.access_token,
      calendarId: row.calendar_id,
    };
  }

  return { accessToken: row.access_token, calendarId: row.calendar_id };
}

/** Gets the existing calendar ID, or creates a new one and saves it. */
export async function getOrCreateCalendar(
  businessId: string,
  businessName: string
): Promise<string> {
  const supabase = await createClient();
  const tokens = await getValidTokens(businessId);
  if (!tokens) throw new Error("Not connected to Google Calendar");

  if (tokens.calendarId) return tokens.calendarId;

  const res = await fetch(`${GCAL_BASE}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: `${businessName} — HustleBricks`,
      description: "Jobs and appointments managed via HustleBricks",
    }),
  });

  if (!res.ok) throw new Error("Failed to create Google Calendar");
  const calendar = await res.json();

  await supabase
    .from("google_calendar_tokens")
    .update({
      calendar_id: calendar.id,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  return calendar.id as string;
}

/** Push a job to the shared business Google Calendar. Creates or updates the event. */
export async function syncJobToCalendar(
  job: JobForCalendar,
  businessId: string,
  businessName: string
): Promise<void> {
  const tokens = await getValidTokens(businessId);
  if (!tokens) return; // Not connected — silently skip

  const calendarId = await getOrCreateCalendar(businessId, businessName);
  const eventId = jobIdToEventId(job.id);

  const start = new Date(job.scheduled_at);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const title = job.job_line_items[0]?.description ?? "Service Job";
  const clientName = job.clients?.name ?? "";
  const summary = clientName ? `${title} — ${clientName}` : title;

  const event: Record<string, unknown> = {
    id: eventId,
    summary,
    start: { dateTime: start.toISOString(), timeZone: "UTC" },
    end: { dateTime: end.toISOString(), timeZone: "UTC" },
    status: job.status === "cancelled" ? "cancelled" : "confirmed",
  };
  if (job.notes) event.description = job.notes;
  if (job.clients?.address) event.location = job.clients.address;

  // Try update first; fall back to insert if event doesn't exist yet
  const updateRes = await fetch(
    `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (updateRes.status === 404) {
    await fetch(
      `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );
  }
}

/** Send a Google Calendar share invitation to an employee's email address. */
export async function inviteTeamMember(
  businessId: string,
  email: string
): Promise<void> {
  const tokens = await getValidTokens(businessId);
  if (!tokens?.calendarId) throw new Error("No calendar connected");

  const res = await fetch(
    `${GCAL_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/acl`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        scope: { type: "user", value: email },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to invite ${email}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`
    );
  }
}

/** Returns true if the business has a Google Calendar connection. */
export async function isConnected(businessId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("id")
    .eq("business_id", businessId)
    .single();
  return !!data;
}
