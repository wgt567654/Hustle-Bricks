import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import BookWidget from "./BookWidget";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = adminClient();

  // Look up by slug first, fall back to UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const query = supabase
    .from("businesses")
    .select("id, name, contact_email, contact_phone, logo_url");

  let biz = null;
  if (isUuid) {
    const { data } = await query.eq("id", slug).maybeSingle();
    biz = data;
  } else {
    // slug column may not exist yet — fall back gracefully
    try {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, contact_email, contact_phone, logo_url")
        .eq("slug", slug)
        .maybeSingle();
      biz = data;
    } catch {
      biz = null;
    }
  }

  if (!biz) notFound();

  // Fetch scheduling settings and blocked dates for the calendar
  const [{ data: schedData }, { data: blockedData }] = await Promise.all([
    supabase
      .from("scheduling_settings")
      .select("unavailable_days, day_hours")
      .eq("business_id", biz.id)
      .maybeSingle(),
    supabase
      .from("blocked_dates")
      .select("blocked_date")
      .eq("business_id", biz.id),
  ]);

  const unavailableDays: number[] = schedData?.unavailable_days ?? [0, 6];
  const dayHours: Record<string, { from: string; until: string }> =
    schedData?.day_hours ?? {};
  const blockedDates: string[] = (blockedData ?? []).map(
    (r: { blocked_date: string }) => r.blocked_date
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-lg mx-auto px-5 py-10 pb-20">
        {/* Header */}
        <div className="text-center mb-8">
          {biz.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={biz.logo_url}
              alt={biz.name}
              className="h-14 w-auto mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            {biz.name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Request a quote, schedule a service, or get in touch.
          </p>
        </div>

        <BookWidget
          businessId={biz.id}
          businessName={biz.name}
          contactEmail={biz.contact_email ?? null}
          contactPhone={biz.contact_phone ?? null}
          unavailableDays={unavailableDays}
          dayHours={dayHours}
          blockedDates={blockedDates}
        />

        <p className="text-center text-xs text-gray-400 mt-8">
          Powered by{" "}
          <span className="font-bold text-gray-500">HustleBricks</span>
        </p>
      </div>
    </div>
  );
}
