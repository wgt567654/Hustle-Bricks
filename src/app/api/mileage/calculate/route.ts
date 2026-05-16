import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { employee_id, date } = await req.json() as { employee_id: string; date: string };
  if (!employee_id || !date) {
    return NextResponse.json({ error: "employee_id and date are required" }, { status: 400 });
  }

  // Verify caller owns the business this employee belongs to
  const { data: member } = await supabase
    .from("team_members")
    .select("id, home_address, business_id, businesses(owner_id, mileage_rate_per_mile)")
    .eq("id", employee_id)
    .single();

  if (!member) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const biz = member.businesses as unknown as { owner_id: string; mileage_rate_per_mile: number } | null;
  if (!biz || biz.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!member.home_address) {
    return NextResponse.json({ error: "Employee has no home address on file" }, { status: 422 });
  }

  // Fetch jobs assigned to this employee on the given date, ordered by schedule time
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, scheduled_at, clients(address)")
    .eq("assigned_member_id", employee_id)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd)
    .order("scheduled_at", { ascending: true });

  const stops = (jobs ?? [])
    .map((j) => (j.clients as unknown as { address: string | null } | null)?.address)
    .filter(Boolean) as string[];

  if (stops.length === 0) {
    return NextResponse.json({ error: "No jobs with addresses found for this employee on this date" }, { status: 422 });
  }

  // Build Google Maps Directions API request
  // Origin and destination = home address; waypoints = job addresses in order
  const origin = encodeURIComponent(member.home_address);
  const destination = encodeURIComponent(member.home_address);
  const waypoints = stops.map((s) => encodeURIComponent(s)).join("|");

  const mapsUrl =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${origin}` +
    `&destination=${destination}` +
    `&waypoints=optimize:false|${waypoints}` +
    `&key=${MAPS_API_KEY}`;

  const mapsRes = await fetch(mapsUrl);
  const mapsData = await mapsRes.json() as {
    status: string;
    routes?: Array<{ legs: Array<{ distance: { value: number } }> }>;
  };

  if (mapsData.status !== "OK" || !mapsData.routes?.[0]) {
    return NextResponse.json({ error: `Google Maps error: ${mapsData.status}` }, { status: 502 });
  }

  const totalMeters = mapsData.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
  const totalMiles = parseFloat((totalMeters / 1609.344).toFixed(2));
  const rate = biz.mileage_rate_per_mile ?? 0.70;

  // Upsert so re-calculating the same day updates the record
  const { data: record, error: upsertError } = await supabase
    .from("daily_mileage")
    .upsert({
      business_id: member.business_id,
      employee_id,
      date,
      total_miles: totalMiles,
      rate_per_mile: rate,
      route_snapshot: {
        origin: member.home_address,
        stops,
        google_status: mapsData.status,
      },
      calculated_at: new Date().toISOString(),
    }, { onConflict: "employee_id,date" })
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ record });
}
