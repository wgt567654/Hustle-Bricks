"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

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

export default function CanvassingPage() {
  const router = useRouter();
  return (
    <CanvassingMap
      onBookNow={(address) =>
        router.push(`/quotes/new?address=${encodeURIComponent(address)}`)
      }
    />
  );
}
