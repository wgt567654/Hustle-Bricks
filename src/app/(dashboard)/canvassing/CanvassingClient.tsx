"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

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

const CanvassingMap = dynamic(
  () => import("@/components/canvassing/CanvassingMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading map…</p>
      </div>
    ),
  }
);

export default function CanvassingClient({
  initialBusinessId,
  initialTeamMemberId,
  initialProperties,
}: {
  initialBusinessId: string | null;
  initialTeamMemberId: string | null;
  initialProperties: CanvassingProperty[];
}) {
  const router = useRouter();
  return (
    <CanvassingMap
      captureLeadOnBook
      showLeadsLink
      onBookNow={() => router.push("/canvassing/leads")}
      initialBusinessId={initialBusinessId}
      initialTeamMemberId={initialTeamMemberId}
      initialProperties={initialProperties}
    />
  );
}
