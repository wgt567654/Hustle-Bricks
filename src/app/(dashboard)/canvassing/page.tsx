import { createClient } from "@/lib/supabase/server";
import CanvassingClient from "./CanvassingClient";

type CanvassingStatus = "not_visited" | "no_answer" | "no" | "interested" | "booked";

type CanvassingProperty = {
  id: string;
  lat: number;
  lng: number;
  address: string | null;
  status: CanvassingStatus;
  notes: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  last_visited_at: string | null;
  visited_by: string | null;
};

function normalizeProperty(raw: Record<string, unknown>): CanvassingProperty {
  return {
    ...(raw as CanvassingProperty),
    lat: typeof raw.lat === "string" ? parseFloat(raw.lat) : (raw.lat as number),
    lng: typeof raw.lng === "string" ? parseFloat(raw.lng) : (raw.lng as number),
  };
}

export default async function CanvassingPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let businessId: string | null = null;
  let teamMemberId: string | null = null;
  let properties: CanvassingProperty[] = [];

  if (userId) {
    const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", userId).maybeSingle();
    let bizId: string | null = null;

    if (biz) {
      bizId = biz.id;
      businessId = bizId;
    } else {
      const { data: tm } = await supabase.from("team_members").select("id, business_id")
        .eq("user_id", userId).eq("is_active", true).single();
      if (tm) {
        bizId = (tm as { id: string; business_id: string }).business_id;
        businessId = bizId;
        teamMemberId = (tm as { id: string; business_id: string }).id;
      }
    }

    if (bizId) {
      const { data: props } = await supabase.from("canvassing_properties").select("*")
        .eq("business_id", bizId).order("created_at", { ascending: false });
      properties = (props ?? []).map((p) => normalizeProperty(p as Record<string, unknown>));
    }
  }

  return (
    <CanvassingClient
      initialBusinessId={businessId}
      initialTeamMemberId={teamMemberId}
      initialProperties={properties}
    />
  );
}
