import { createClient } from "@/lib/supabase/server";
import HeatmapClient from "./HeatmapClient";

type ZoneData = {
  zip: string;
  jobCount: number;
  completedCount: number;
  totalRevenue: number;
  avgRevenue: number;
  lastJobDate: string | null;
  daysSinceLastJob: number | null;
  canvassTotal: number;
  canvassBooked: number;
  conversionRate: number | null;
};

function extractZip(address: string): string | null {
  return address.match(/\b(\d{5})\b/)?.[1] ?? null;
}

export default async function HeatmapPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let zones: ZoneData[] = [];

  if (userId) {
    const { data: bizList } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .limit(1);
    const business = bizList?.[0];

    if (business) {
      const [{ data: jobs }, { data: canvassing }] = await Promise.all([
        supabase
          .from("jobs")
          .select("status, total, scheduled_at, clients(address)")
          .eq("business_id", business.id)
          .not("status", "eq", "cancelled"),
        supabase
          .from("canvassing_properties")
          .select("address, status")
          .eq("business_id", business.id),
      ]);

      const byZip = new Map<string, { jobCount: number; completedCount: number; totalRevenue: number; dates: string[] }>();

      for (const job of jobs ?? []) {
        const address = (job as unknown as { clients: { address: string } | null }).clients?.address;
        if (!address) continue;
        const zip = extractZip(address);
        if (!zip) continue;
        const entry = byZip.get(zip) ?? { jobCount: 0, completedCount: 0, totalRevenue: 0, dates: [] };
        entry.jobCount++;
        if (job.status === "completed") {
          entry.completedCount++;
          entry.totalRevenue += (job.total as number) ?? 0;
        }
        if (job.scheduled_at) entry.dates.push(job.scheduled_at as string);
        byZip.set(zip, entry);
      }

      const canvassByZip = new Map<string, { total: number; booked: number }>();
      for (const p of canvassing ?? []) {
        const zip = extractZip((p as unknown as { address: string | null }).address ?? "");
        if (!zip) continue;
        const entry = canvassByZip.get(zip) ?? { total: 0, booked: 0 };
        if ((p as unknown as { status: string }).status !== "not_visited") entry.total++;
        if ((p as unknown as { status: string }).status === "booked") entry.booked++;
        canvassByZip.set(zip, entry);
      }

      const now = Date.now();

      for (const [zip, data] of byZip) {
        const lastJobDate = data.dates.length > 0 ? [...data.dates].sort().at(-1) ?? null : null;
        const daysSinceLastJob = lastJobDate
          ? Math.floor((now - new Date(lastJobDate).getTime()) / 86400000)
          : null;
        const cv = canvassByZip.get(zip);
        const conversionRate = cv && cv.total > 0 ? Math.round((cv.booked / cv.total) * 100) : null;

        zones.push({
          zip,
          jobCount: data.jobCount,
          completedCount: data.completedCount,
          totalRevenue: data.totalRevenue,
          avgRevenue: data.completedCount > 0 ? Math.round(data.totalRevenue / data.completedCount) : 0,
          lastJobDate,
          daysSinceLastJob,
          canvassTotal: cv?.total ?? 0,
          canvassBooked: cv?.booked ?? 0,
          conversionRate,
        });
      }
    }
  }

  return <HeatmapClient initialZones={zones} />;
}
