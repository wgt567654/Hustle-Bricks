import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geo";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/geo/geocode — body: { kind: "job" | "member", id: string }
 *
 * Looks up the row's address (job → its client's address, member → home_address),
 * geocodes it, persists lat/lng, and returns { lat, lng }.
 *
 * Auth: the caller's RLS-scoped session must be able to read the row
 * (business owner, or the team member themselves). Hidden/missing rows → 404.
 *
 * Degrades gracefully: missing GOOGLE_MAPS_API_KEY, empty address, or a
 * geocoding failure returns { lat: null, lng: null } — never a 500.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { kind?: unknown; id?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const kind = body?.kind;
  const id = body?.id;
  if ((kind !== "job" && kind !== "member") || typeof id !== "string" || !id) {
    return NextResponse.json({ error: "kind ('job'|'member') and id required" }, { status: 400 });
  }

  // Look up the address through the caller's RLS-scoped client so we only
  // proceed when they're allowed to see this row.
  let address: string | null = null;
  if (kind === "job") {
    const { data } = await supabase
      .from("jobs")
      .select("id, clients ( address )")
      .eq("id", id)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const clients = data.clients as { address: string | null } | { address: string | null }[] | null;
    address = Array.isArray(clients) ? clients[0]?.address ?? null : clients?.address ?? null;
  } else {
    const { data } = await supabase
      .from("team_members")
      .select("id, home_address")
      .eq("id", id)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    address = (data as { home_address: string | null }).home_address;
  }

  if (!address?.trim()) return NextResponse.json({ lat: null, lng: null });

  const coords = await geocodeAddress(address);
  if (!coords) return NextResponse.json({ lat: null, lng: null });

  // Persist via service role (RLS-scoped clients may be read-only here).
  // Best-effort: a persistence failure still returns the coords.
  if (kind === "job") {
    await supabaseAdmin.from("jobs").update({ geo_lat: coords.lat, geo_lng: coords.lng }).eq("id", id);
  } else {
    await supabaseAdmin.from("team_members").update({ home_lat: coords.lat, home_lng: coords.lng }).eq("id", id);
  }

  return NextResponse.json({ lat: coords.lat, lng: coords.lng });
}
