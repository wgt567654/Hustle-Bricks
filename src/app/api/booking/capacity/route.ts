import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!businessId || !date) {
    return NextResponse.json({ error: "Missing businessId or date" }, { status: 400 });
  }

  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat

  // 1. Get crew size
  const { data: crewData } = await supabase
    .from("business_crew_settings")
    .select("crew_size")
    .eq("business_id", businessId)
    .maybeSingle();
  const crewSize = (crewData as { crew_size: number } | null)?.crew_size ?? 1;

  // 2. Get scheduling settings to know which hours to include
  const { data: schedData } = await supabase
    .from("scheduling_settings")
    .select("day_hours, unavailable_days")
    .eq("business_id", businessId)
    .maybeSingle();

  const unavailableDays: number[] = (schedData as { unavailable_days: number[] } | null)?.unavailable_days ?? [0, 6];
  const dayHours: Record<string, { from: string; until: string }> =
    (schedData as { day_hours: Record<string, { from: string; until: string }> } | null)?.day_hours ?? {};

  // If the day is marked unavailable, return empty
  if (unavailableDays.includes(dayOfWeek)) {
    return NextResponse.json({});
  }

  const dayKey = String(dayOfWeek);
  const dayRange = dayHours[dayKey];
  if (!dayRange) {
    return NextResponse.json({});
  }

  // Build the list of hour slots for this day
  const fromHour = parseInt(dayRange.from.split(":")[0]);
  const untilHour = parseInt(dayRange.until.split(":")[0]);
  const slots: string[] = [];
  for (let h = fromHour; h < untilHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }

  // 3. Get employee availability for this business on this day of week
  const { data: availData } = await supabase
    .from("employee_availability")
    .select("from_time, until_time")
    .eq("business_id", businessId)
    .eq("day_of_week", dayOfWeek);

  // 4. Get accepted bookings for this date
  const { data: bookingData } = await supabase
    .from("booking_requests")
    .select("requested_time")
    .eq("business_id", businessId)
    .eq("requested_date", date)
    .eq("status", "accepted");

  // Count accepted bookings per slot
  const bookedCounts: Record<string, number> = {};
  for (const b of bookingData ?? []) {
    const slot = (b as { requested_time: string }).requested_time;
    bookedCounts[slot] = (bookedCounts[slot] ?? 0) + 1;
  }

  // 5. Compute capacity per slot
  const capacity: Record<string, number> = {};
  for (const slot of slots) {
    const slotHour = parseInt(slot.split(":")[0]);

    // Count employees available at this hour
    let availableEmployees = 0;
    for (const emp of availData ?? []) {
      const empFrom = parseInt((emp as { from_time: string; until_time: string }).from_time.split(":")[0]);
      const empUntil = parseInt((emp as { from_time: string; until_time: string }).until_time.split(":")[0]);
      if (slotHour >= empFrom && slotHour < empUntil) {
        availableEmployees++;
      }
    }

    const maxConcurrent = Math.floor(availableEmployees / crewSize);
    const alreadyBooked = bookedCounts[slot] ?? 0;
    capacity[slot] = Math.max(0, maxConcurrent - alreadyBooked);
  }

  return NextResponse.json(capacity);
}
