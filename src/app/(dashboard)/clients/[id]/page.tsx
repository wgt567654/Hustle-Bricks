"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { STATUS_HEX } from "@/lib/status-colors";

type Tag = "residential" | "commercial" | "vip";
type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
type RecurringPlan = "none" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";

type ClientDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tag: Tag;
  notes: string | null;
  recurring_plan: RecurringPlan;
  created_at: string;
};

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  completed_at: string | null;
  job_line_items: { description: string }[];
  payments: { status: string }[];
};

const TAG_LABELS: Record<Tag, string> = {
  residential: "Residential",
  commercial: "Commercial",
  vip: "VIP",
};

const TAG_COLORS: Record<Tag, { bg: string; text: string; border: string }> = {
  residential: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  commercial: { bg: "bg-foreground/10", text: "text-foreground", border: "border-foreground/10" },
  vip: { bg: "icon-orange", text: "", border: "border-[var(--color-status-in-progress)]/20" },
};

const STATUS_COLORS = STATUS_HEX;

const STATUS_LABELS: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PLAN_LABELS: Record<RecurringPlan, string> = {
  none: "No Plan",
  weekly: "Weekly",
  biweekly: "Bi-Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annual",
};

const PLAN_OPTIONS: RecurringPlan[] = ["none", "weekly", "biweekly", "monthly", "quarterly", "annually"];

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", tag: "residential" as Tag, notes: "", recurring_plan: "none" as RecurringPlan });
  const [saving, setSaving] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);

  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  function copyPortalLink() {
    const url = `${window.location.origin}/portal/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setPortalCopied(true);
      setTimeout(() => setPortalCopied(false), 2000);
    });
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: clientData, error } = await supabase
        .from("clients")
        .select("id, name, email, phone, address, tag, notes, recurring_plan, created_at")
        .eq("id", id)
        .single();

      if (error || !clientData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const c = clientData as ClientDetail;
      setClient(c);
      setNotesValue(c.notes ?? "");
      setForm({
        name: c.name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        address: c.address ?? "",
        tag: c.tag as Tag,
        notes: c.notes ?? "",
        recurring_plan: (c.recurring_plan as RecurringPlan) ?? "none",
      });

      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, status, total, scheduled_at, completed_at, job_line_items(description), payments(status)")
        .eq("client_id", id)
        .order("scheduled_at", { ascending: false });

      setJobs((jobsData as unknown as Job[]) ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  async function saveEdit() {
    if (!client) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("clients").update({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      tag: form.tag,
      notes: form.notes.trim() || null,
      recurring_plan: form.recurring_plan,
    }).eq("id", client.id);

    setClient((c) => c ? {
      ...c,
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
      recurring_plan: form.recurring_plan,
    } : c);
    setNotesValue(form.notes.trim());
    setSaving(false);
    setEditOpen(false);
  }

  async function saveNotes() {
    if (!client) return;
    setSavingNotes(true);
    const supabase = createClient();
    await supabase.from("clients").update({ notes: notesValue.trim() || null }).eq("id", client.id);
    setClient((c) => c ? { ...c, notes: notesValue.trim() || null } : c);
    setSavingNotes(false);
    setEditingNotes(false);
  }

  function startEditingNotes() {
    setEditingNotes(true);
    setTimeout(() => notesRef.current?.focus(), 50);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading client…</p>
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="font-bold text-foreground">Client not found</p>
        <button onClick={() => router.push("/clients")} className="text-sm text-primary font-bold">← Back to Clients</button>
      </div>
    );
  }

  const upcomingJobs = jobs.filter((j) => j.status === "scheduled" || j.status === "in_progress");
  const pastJobs = jobs.filter((j) => j.status === "completed" || j.status === "cancelled");
  const lifetimeRevenue = pastJobs.filter((j) => j.status === "completed").reduce((s, j) => {
    const paid = j.payments?.some((p) => p.status === "paid");
    return paid ? s + j.total : s;
  }, 0);
  const outstanding = pastJobs.filter((j) => j.status === "completed").reduce((s, j) => {
    const paid = j.payments?.some((p) => p.status === "paid");
    return !paid ? s + j.total : s;
  }, 0);

  const tagStyle = TAG_COLORS[client.tag];
  const hasPlan = client.recurring_plan && client.recurring_plan !== "none";

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-32">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/clients")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</p>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-tight truncate">{client.name}</h1>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="flex size-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </button>
      </div>

      {/* Profile card */}
      <Card className="rounded-3xl border-border shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col gap-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className={`flex size-16 shrink-0 items-center justify-center rounded-2xl font-extrabold text-xl border ${tagStyle.bg} ${tagStyle.text} ${tagStyle.border}`}>
              {getInitials(client.name)}
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-extrabold text-foreground leading-tight">{client.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={`border-0 text-[10px] font-bold uppercase tracking-wide ${tagStyle.bg} ${tagStyle.text}`}>
                  {TAG_LABELS[client.tag]}
                </Badge>
                {hasPlan && (
                  <Badge variant="secondary" className="border-0 text-[10px] font-bold uppercase tracking-wide icon-violet">
                    <span className="material-symbols-outlined text-[10px] mr-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>autorenew</span>
                    {PLAN_LABELS[client.recurring_plan]}
                  </Badge>
                )}
                {client.tag === "vip" && (
                  <span className="material-symbols-outlined text-[var(--color-status-in-progress)] text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Client since {formatDate(client.created_at)}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl icon-green  font-bold text-sm hover:opacity-90 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                Call
              </a>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                Email
              </a>
            )}
            <button
              onClick={copyPortalLink}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                portalCopied
                  ? "icon-green "
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {portalCopied ? "check_circle" : "share"}
              </span>
              {portalCopied ? "Copied!" : "Portal"}
            </button>
            <button
              onClick={() => router.push(`/quotes/new?client=${client.id}`)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">request_quote</span>
              Quote
            </button>
          </div>

          {/* Contact info */}
          {(client.phone || client.email || client.address) && (
            <>
              <Separator className="bg-border/50" />
              <div className="flex flex-col gap-3">
                {client.phone && (
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-muted-foreground">call</span>
                    <span className="text-sm text-foreground font-medium">{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-muted-foreground">mail</span>
                    <span className="text-sm text-foreground font-medium">{client.email}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[18px] text-muted-foreground mt-0.5">location_on</span>
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span className="text-sm text-foreground font-medium leading-snug">{client.address}</span>
                      <a
                        href={`https://maps.apple.com/?q=${encodeURIComponent(client.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">navigation</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Revenue summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</span>
          <span className="text-xl font-extrabold text-[var(--color-status-completed)] tracking-tight">
            ${lifetimeRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-muted-foreground">lifetime</span>
        </Card>
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding</span>
          <span className={`text-xl font-extrabold tracking-tight ${outstanding > 0 ? "text-[var(--color-status-in-progress)]" : "text-[var(--color-status-completed)]"}`}>
            {outstanding > 0 ? `$${outstanding.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "✓"}
          </span>
          <span className="text-[10px] text-muted-foreground">unpaid</span>
        </Card>
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jobs</span>
          <span className="text-xl font-extrabold text-foreground tracking-tight">{jobs.length}</span>
          <span className="text-[10px] text-muted-foreground">{upcomingJobs.length} upcoming</span>
        </Card>
      </div>

      {/* Property Notes */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--color-status-in-progress)]" style={{ fontVariationSettings: "'FILL' 1" }}>sticky_note_2</span>
            <p className="text-sm font-bold text-foreground">Property Notes</p>
          </div>
          {!editingNotes && (
            <button
              onClick={startEditingNotes}
              className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
            </button>
          )}
        </div>
        <div className="p-4">
          {editingNotes ? (
            <div className="flex flex-col gap-3">
              <textarea
                ref={notesRef}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                placeholder="Gate code, dog in yard, parking notes, glass type preferences…"
                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingNotes(false); setNotesValue(client.notes ?? ""); }}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {savingNotes ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : client.notes ? (
            <p
              className="text-sm text-foreground leading-relaxed cursor-text"
              onClick={startEditingNotes}
            >
              {client.notes}
            </p>
          ) : (
            <button
              onClick={startEditingNotes}
              className="w-full flex flex-col items-center gap-1.5 py-5 text-center rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-colors"
            >
              <span className="material-symbols-outlined text-[28px] text-muted-foreground/40">add_notes</span>
              <p className="text-xs font-medium text-muted-foreground">Add property notes</p>
              <p className="text-[11px] text-muted-foreground/60">Gate codes, pets, parking, preferences…</p>
            </button>
          )}
        </div>
      </Card>

      {/* Upcoming jobs */}
      {upcomingJobs.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Upcoming</h3>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs font-bold">{upcomingJobs.length}</Badge>
          </div>
          {upcomingJobs.map((job) => <JobCard key={job.id} job={job} onClick={() => router.push(`/jobs/${job.id}`)} />)}
        </section>
      )}

      {/* Job history */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">History</h3>
          {pastJobs.length > 0 && (
            <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-xs">{pastJobs.length}</Badge>
          )}
        </div>

        {jobs.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center bg-card rounded-2xl border border-border/50">
            <span className="material-symbols-outlined text-[40px] text-muted-foreground/30">home_repair_service</span>
            <p className="text-sm text-muted-foreground">No jobs yet</p>
            <button
              onClick={() => router.push(`/quotes/new?client=${client.id}`)}
              className="mt-1 text-sm font-bold text-primary hover:underline"
            >
              Create a quote →
            </button>
          </div>
        )}

        {pastJobs.length === 0 && jobs.length > 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No completed jobs yet</p>
        )}

        {pastJobs.map((job) => <JobCard key={job.id} job={job} onClick={() => router.push(`/jobs/${job.id}`)} />)}
      </section>

      {/* New quote FAB */}
      <button
        onClick={() => router.push(`/quotes/new?client=${client.id}`)}
        className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-primary/40 shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">request_quote</span>
      </button>

      {/* Edit modal */}
      {editOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] max-w-xl mx-auto rounded-t-3xl bg-background shadow-2xl border-t border-border overflow-hidden">
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 shrink-0">
              <h2 className="text-lg font-extrabold text-foreground">Edit Client</h2>
              <button onClick={() => setEditOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client Type</label>
                <div className="flex gap-2">
                  {(["residential", "commercial", "vip"] as Tag[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, tag: t }))}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-95 ${
                        form.tag === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-foreground"
                      }`}
                    >
                      {TAG_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Maintenance Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLAN_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setForm((f) => ({ ...f, recurring_plan: p }))}
                      className={`rounded-xl border py-2.5 text-xs font-bold transition-all active:scale-95 ${
                        form.recurring_plan === p
                          ? "border-highlight-violet icon-violet"
                          : "border-border bg-muted/40 text-foreground"
                      }`}
                    >
                      {PLAN_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none" />
              </div>
              <div className="h-2" />
            </div>

            <div className="px-5 py-4 border-t border-border/50 shrink-0 bg-background">
              <button
                onClick={saveEdit}
                disabled={saving || !form.name.trim()}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-extrabold text-sm hover:bg-primary/90 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const title = job.job_line_items[0]?.description ?? "Job";
  const color = STATUS_COLORS[job.status];
  const isPaid = job.payments?.some((p) => p.status === "paid");
  const date = job.completed_at ?? job.scheduled_at;

  return (
    <Card
      onClick={onClick}
      className="overflow-hidden rounded-2xl border-border shadow-sm cursor-pointer hover:shadow-md hover:border-primary/20 transition-all"
    >
      <div className="h-1 w-full" style={{ backgroundColor: color }} />
      <div className="p-4 flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: color }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            home_repair_service
          </span>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-bold text-foreground text-sm leading-tight truncate">{title}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className="border-0 text-[9px] font-bold uppercase px-1.5 py-0" style={{ backgroundColor: `${color}18`, color }}>
              {STATUS_LABELS[job.status]}
            </Badge>
            {date && <span className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-extrabold text-sm text-foreground">${job.total.toFixed(2)}</span>
          {job.status === "completed" && (
            <Badge variant="secondary" className={`border-0 text-[9px] font-bold px-1.5 py-0 ${isPaid ? "icon-green " : "icon-orange "}`}>
              {isPaid ? "Paid" : "Unpaid"}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
