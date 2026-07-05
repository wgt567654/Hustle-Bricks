"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [showEmptyState, setShowEmptyState] = useState(initialProperties.length === 0);

  // Hide the empty-state hint as soon as the user starts interacting with the map
  useEffect(() => {
    if (!showEmptyState) return;
    const dismiss = () => setShowEmptyState(false);
    window.addEventListener("pointerdown", dismiss, { once: true });
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [showEmptyState]);

  return (
    <>
      <CanvassingMap
        captureLeadOnBook
        showLeadsLink
        onBookNow={() => router.push("/canvassing/leads")}
        initialBusinessId={initialBusinessId}
        initialTeamMemberId={initialTeamMemberId}
        initialProperties={initialProperties}
      />
      {showEmptyState && (
        <div className="pointer-events-none fixed inset-0 z-[600] flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/85 backdrop-blur-sm px-6 py-5 text-center shadow-lg">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">explore</span>
            <p className="text-sm font-medium text-muted-foreground">No canvassing activity yet</p>
            <p className="text-xs text-muted-foreground/60">Tap the map to log your first door knock</p>
          </div>
        </div>
      )}
    </>
  );
}
