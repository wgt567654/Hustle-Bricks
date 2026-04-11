"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "member" | "sales";

type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  is_pending: boolean;
  certifications: string[];
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
  sales: "Sales",
};

const CERT_OPTIONS = [
  "Licensed",
  "Insured",
  "OSHA 10",
  "CDL",
  "First Aid",
  "Background Check",
  "High Rise",
  "Commercial",
];

const EMPTY_FORM = { name: "", email: "", role: "member" as Role, certifications: [] as string[] };

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function toggleCert(cert: string, certs: string[]): string[] {
  return certs.includes(cert) ? certs.filter((c) => c !== cert) : [...certs, cert];
}

export default function TeamPage() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [workload, setWorkload] = useState<Record<string, number>>({});
  const [pendingMembers, setPendingMembers] = useState<TeamMember[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "member" as Role, certifications: [] as string[] });
  const [editSaving, setEditSaving] = useState(false);

  function copyPortalLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/team-portal/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function openEdit(member: TeamMember) {
    setEditMember(member);
    setEditForm({
      name: member.name,
      email: member.email ?? "",
      role: member.role,
      certifications: member.certifications ?? [],
    });
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!business) { setLoading(false); return; }
      setBusinessId(business.id);

      const { data } = await supabase
        .from("team_members")
        .select("id, name, email, role, is_active, certifications")
        .eq("business_id", business.id)
        .order("name");

      const allMembers = ((data ?? []) as TeamMember[]).map((m) => ({ ...m, is_pending: false }));
      const activeMembers = allMembers.filter((m) => m.is_active);
      const pendingList: TeamMember[] = [];

      const memberList = activeMembers;
      setMembers(memberList.map((m) => ({ ...m, certifications: m.certifications ?? [] })));
      setPendingMembers(pendingList.map((m) => ({ ...m, certifications: m.certifications ?? [] })));

      // Fetch workload: active jobs per member
      if (memberList.length > 0) {
        const memberIds = memberList.map((m) => m.id);
        const { data: jobData } = await supabase
          .from("jobs")
          .select("assigned_member_id")
          .in("assigned_member_id", memberIds)
          .in("status", ["scheduled", "in_progress"]);

        const counts: Record<string, number> = {};
        for (const j of jobData ?? []) {
          if (j.assigned_member_id) {
            counts[j.assigned_member_id] = (counts[j.assigned_member_id] ?? 0) + 1;
          }
        }
        setWorkload(counts);
      }

      setLoading(false);
    }
    load();
  }, []);

  const filtered = roleFilter === "all" ? members : members.filter((m) => m.role === roleFilter);

  async function handleApprove(id: string) {
    setApprovingId(id);
    const supabase = createClient();
    const { data } = await supabase
      .from("team_members")
      .update({ is_active: true, is_pending: false })
      .eq("id", id)
      .select("id, name, email, role, is_active, is_pending, certifications")
      .single();
    if (data) {
      setPendingMembers((prev) => prev.filter((m) => m.id !== id));
      setMembers((prev) => [...prev, { ...data, certifications: data.certifications ?? [] }].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setApprovingId(null);
  }

  async function handleReject(id: string) {
    setRejectingId(id);
    const supabase = createClient();
    await supabase.from("team_members").update({ is_pending: false }).eq("id", id);
    setPendingMembers((prev) => prev.filter((m) => m.id !== id));
    setRejectingId(null);
  }

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("team_members")
      .insert({
        business_id: businessId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        role: form.role,
        certifications: form.certifications,
      })
      .select("id")
      .single();

    if (error || !data) {
      setError(error?.message ?? "Failed to add member.");
      setSaving(false);
    } else {
      const newMember: TeamMember = {
        id: data.id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        role: form.role,
        is_active: true,
        is_pending: false,
        certifications: form.certifications,
      };
      setMembers((prev) => [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(EMPTY_FORM);
      setShowModal(false);
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editMember) return;
    setEditSaving(true);
    const supabase = createClient();
    await supabase.from("team_members").update({
      name: editForm.name.trim(),
      email: editForm.email.trim() || null,
      role: editForm.role,
      certifications: editForm.certifications,
    }).eq("id", editMember.id);

    setMembers((prev) => prev.map((m) =>
      m.id === editMember.id
        ? { ...m, name: editForm.name.trim(), email: editForm.email.trim() || null, role: editForm.role, certifications: editForm.certifications }
        : m
    ));
    setEditSaving(false);
    setEditMember(null);
  }

  async function handleRemove(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("team_members").update({ is_active: false }).eq("id", id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-8 py-6 max-w-xl mx-auto lg:max-w-none pb-40 lg:pb-8">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Team Roster</h1>
        <p className="text-sm text-muted-foreground">Manage your crew, roles, and certifications.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
        {([
          { label: "All Members", value: "all" },
          { label: "Admin", value: "admin" },
          { label: "Sales", value: "sales" },
          { label: "Members", value: "member" },
        ] as { label: string; value: Role | "all" }[]).map((tab) => (
          <button key={tab.value} onClick={() => setRoleFilter(tab.value)}>
            <Badge
              className={`px-4 py-1.5 text-xs rounded-full shrink-0 cursor-pointer transition-colors ${
                roleFilter === tab.value
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
              }`}
              variant={roleFilter === tab.value ? "default" : "outline"}
            >
              {tab.label}
            </Badge>
          </button>
        ))}
      </div>

      {/* Pending approvals */}
      {pendingMembers.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pending Approval</h2>
            <span className="text-[10px] font-bold bg-[var(--color-status-in-progress)] text-white px-2 py-0.5 rounded-full">
              {pendingMembers.length}
            </span>
          </div>
          {pendingMembers.map((member) => (
            <Card key={member.id} className="overflow-hidden rounded-2xl border-[var(--color-status-in-progress)]/20 shadow-sm bg-status-in-progress/10">
              <div className="p-4 flex gap-4 items-center">
                <div className="flex size-12 items-center justify-center rounded-2xl icon-orange  text-base font-extrabold shrink-0">
                  {getInitials(member.name)}
                </div>
                <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                  <span className="font-bold text-foreground leading-tight">{member.name}</span>
                  {member.email && <span className="text-xs text-muted-foreground">{member.email}</span>}
                  <span className="text-xs text-[var(--color-status-in-progress)] font-medium">Wants to join your team</span>
                </div>
              </div>
              <Separator className="bg-status-in-progress/10" />
              <div className="flex bg-muted/10">
                <button
                  onClick={() => handleReject(member.id)}
                  disabled={rejectingId === member.id}
                  className="flex-1 py-2.5 text-sm font-semibold text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  {rejectingId === member.id ? "…" : "Reject"}
                </button>
                <Separator orientation="vertical" className="bg-status-in-progress/10 h-auto" />
                <button
                  onClick={() => handleApprove(member.id)}
                  disabled={approvingId === member.id}
                  className="flex-1 py-2.5 text-sm font-bold text-[var(--color-status-completed)] hover:opacity-90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  {approvingId === member.id ? "Approving…" : "Approve"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Team list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">group_add</span>
            <p className="text-sm font-medium text-muted-foreground">No team members yet</p>
            <p className="text-xs text-muted-foreground/60">Tap + to add your first crew member</p>
          </div>
        )}

        {filtered.map((member) => {
          const jobCount = workload[member.id] ?? 0;
          return (
            <Card key={member.id} className="overflow-hidden rounded-2xl border-border shadow-sm group hover:border-primary/30 transition-colors">
              <div className="p-4 flex gap-4 items-start">
                {/* Avatar with active dot */}
                <div className="relative shrink-0">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-lg font-extrabold border border-primary/20">
                    {getInitials(member.name)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-[var(--color-status-completed)]" />
                </div>

                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-lg text-foreground leading-tight">{member.name}</h3>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(member)}
                        className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={deletingId === member.id}
                        className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">person_remove</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-bold uppercase tracking-wide border-0 ${
                        member.role === "admin"
                          ? "icon-orange "
                          : member.role === "sales"
                          ? "icon-green "
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {ROLE_LABELS[member.role]}
                    </Badge>
                    {jobCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] font-bold border-0 icon-orange ">
                        <span className="material-symbols-outlined text-[10px] mr-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
                        {jobCount} active {jobCount === 1 ? "job" : "jobs"}
                      </Badge>
                    )}
                  </div>

                  {member.email && (
                    <span className="text-xs text-muted-foreground">{member.email}</span>
                  )}

                  {/* Certifications */}
                  {member.certifications.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {member.certifications.map((cert) => (
                        <span
                          key={cert}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full icon-violet border border-highlight-violet/20"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator className="bg-border/50" />
              <div className="flex bg-muted/30">
                <button onClick={() => router.push(`/calendar`)} className="flex-1 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span> Schedule
                </button>
                <Separator orientation="vertical" className="bg-border/50 h-auto" />
                <button
                  onClick={() => copyPortalLink(member.id)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 hover:bg-muted/50 ${
                    copiedId === member.id
                      ? "text-[var(--color-status-completed)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {copiedId === member.id ? "check_circle" : "link"}
                  </span>
                  {copiedId === member.id ? "Copied!" : "Share Link"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setShowModal(true); setError(null); setForm(EMPTY_FORM); }}
        className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-primary/40 shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">person_add</span>
      </button>

      {/* Add Member Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Add Team Member</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <form onSubmit={handleAdd} className="flex flex-col gap-4">
                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Smith"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    autoFocus
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</label>
                  <div className="flex gap-2">
                    {(["member", "admin", "sales"] as Role[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, role: r }))}
                        className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all active:scale-95 ${
                          form.role === r
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/40 text-foreground hover:bg-muted"
                        }`}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Certifications <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {CERT_OPTIONS.map((cert) => (
                      <button
                        key={cert}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, certifications: toggleCert(cert, f.certifications) }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                          form.certifications.includes(cert)
                            ? "border-highlight-violet icon-violet"
                            : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {form.certifications.includes(cert) && "✓ "}{cert}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="w-full mt-1 rounded-xl font-bold py-3.5 text-sm bg-[#111418] dark:bg-zinc-50 dark:text-[#111418] text-white shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add Member"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditMember(null)} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Edit Member</h2>
              <button
                onClick={() => setEditMember(null)}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</label>
                <div className="flex gap-2">
                  {(["member", "admin", "sales"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, role: r }))}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all active:scale-95 ${
                        editForm.role === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-foreground hover:bg-muted"
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Certifications</label>
                <div className="flex flex-wrap gap-2">
                  {CERT_OPTIONS.map((cert) => (
                    <button
                      key={cert}
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, certifications: toggleCert(cert, f.certifications) }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                        editForm.certifications.includes(cert)
                          ? "border-highlight-violet icon-violet"
                          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {editForm.certifications.includes(cert) && "✓ "}{cert}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editForm.name.trim()}
                className="w-full mt-1 rounded-xl font-bold py-3.5 text-sm bg-primary text-white shadow-md hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
