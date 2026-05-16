import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ predictions: [] }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ predictions: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": MAPS_API_KEY,
    },
    body: JSON.stringify({
      input: q,
      includedPrimaryTypes: ["street_address", "premise"],
    }),
  });

  const data = await res.json() as {
    suggestions?: { placePrediction: { text: { text: string }; placeId: string } }[];
    error?: { message: string; status: string };
  };

  if (data.error) {
    console.error("[places/autocomplete] Google error:", data.error.status, data.error.message);
    return NextResponse.json({ predictions: [], error: data.error.status }, { status: 502 });
  }

  return NextResponse.json({
    predictions: (data.suggestions ?? []).map((s) => ({
      description: s.placePrediction.text.text,
      place_id: s.placePrediction.placeId,
    })),
  });
}
