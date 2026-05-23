"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tag: string | null;
  notes: string | null;
};

type Job = {
  id: string;
  status: string;
  total: number | null;
  scheduled_at: string | null;
  job_line_items: { description: string }[];
};

const TAG_STYLES: Record<string, string> = {
  vip:         "bg-amber-500/10 text-amber-600 border-amber-500/20",
  commercial:  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  residential: "bg-primary/10 text-primary border-primary/20",
};

const STATUS_STYLES: Record<string, string> = {
  completed:   "bg-green-500/10 text-green-600",
  scheduled:   "bg-primary/10 text-primary",
  in_progress: "bg-amber-500/10 text-amber-600",
  cancelled:   "bg-muted text-muted-foreground",
};

function fmtDate(str: string | null) {
  if (!str) return "";
  return new Date(str).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function EmployeeClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs]     = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      if (!tm) return;

      const [{ data: clientData }, { data: jobData }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, email, phone, address, tag, notes")
          .eq("id", id)
          .single(),
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, job_line_items(description)")
          .eq("client_id", id)
          .eq("assigned_member_id", tm.id)
          .order("scheduled_at", { ascending: false })
          .limit(10),
      ]);

      setClient(clientData as unknown as Client);
      setJobs((jobData ?? []) as unknown as Job[]);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto">
        <div className="h-8 w-40 bg-muted animate-pulse rounded-xl" />
        <div className="h-32 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 px-4 text-center">
        <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">person_off</span>
        <p className="text-sm font-semibold text-muted-foreground">Client not found</p>
        <button onClick={() => router.back()} className="text-xs text-primary hover:underline mt-1">Go back</button>
      </div>
    );
  }

  const tagStyle = TAG_STYLES[client.tag ?? "residential"] ?? TAG_STYLES.residential;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto pb-32 lg:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => router.back()}
          className="flex size-8 items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex flex-col flex-1 min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground truncate">{client.name}</h1>
          {client.tag && (
            <span className={`mt-0.5 self-start text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${tagStyle}`}>
              {client.tag}
            </span>
          )}
        </div>
      </div>

      {/* Contact info */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border/50">
        {client.phone && (
          <a
            href={`tel:${client.phone}`}
            className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Phone</span>
              <span className="font-bold text-sm text-foreground">{client.phone}</span>
            </div>
            <span className="material-symbols-outlined text-muted-foreground ml-auto">chevron_right</span>
          </a>
        )}
        {client.email && (
          <a
            href={`mailto:${client.email}`}
            className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Email</span>
              <span className="font-bold text-sm text-foreground">{client.email}</span>
            </div>
            <span className="material-symbols-outlined text-muted-foreground ml-auto">chevron_right</span>
          </a>
        )}
        {client.address && (
          <a
            href={`https://maps.apple.com/?q=${encodeURIComponent(client.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs text-muted-foreground">Address</span>
              <span className="font-bold text-sm text-foreground truncate">{client.address}</span>
            </div>
            <span className="material-symbols-outlined text-muted-foreground ml-auto shrink-0">chevron_right</span>
          </a>
        )}
      </Card>

      {/* Notes */}
      {client.notes && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Notes</h3>
          <Card className="rounded-2xl border-border shadow-sm">
            <p className="p-4 text-sm text-foreground leading-relaxed">{client.notes}</p>
          </Card>
        </section>
      )}

      {/* Job history */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">My Jobs with This Client</h3>
        {jobs.length === 0 ? (
          <Card className="rounded-2xl border-border shadow-sm">
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No jobs with this client yet</p>
            </div>
          </Card>
        ) : (
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border/50">
            {jobs.map((job) => {
              const statusStyle = STATUS_STYLES[job.status] ?? "bg-muted text-muted-foreground";
              const desc = job.job_line_items[0]?.description ?? "Job";
              return (
                <div key={job.id} className="p-4 flex items-center gap-3">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-bold text-sm text-foreground truncate">{desc}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(job.scheduled_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.total != null && (
                      <span className="text-sm font-bold text-foreground">${job.total.toFixed(0)}</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusStyle}`}>
                      {job.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
