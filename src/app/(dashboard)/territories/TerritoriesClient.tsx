"use client";

import dynamic from "next/dynamic";

type TerritoryJob = {
  id: string;
  status: string;
  total: number;
  job_line_items: { description: string }[];
  clients: { name: string; address: string | null } | null;
};

type Member = {
  id: string;
  name: string;
  zips: string[];
  color: string;
  jobCount: number;
};

const TerritoryMapContent = dynamic(() => import("./TerritoryMapContent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-muted-foreground">Loading map…</p>
    </div>
  ),
});

export default function TerritoriesClient({
  initialJobs,
  initialMembers,
  initialZipToMember,
}: {
  initialJobs: TerritoryJob[];
  initialMembers: Member[];
  initialZipToMember: Record<string, string>;
}) {
  return (
    <TerritoryMapContent
      initialJobs={initialJobs}
      initialMembers={initialMembers}
      initialZipToMember={initialZipToMember}
    />
  );
}
