"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  const days: Date[] = [];
  const current = new Date(startDate);
  while (current <= lastDay || days.length % 7 !== 0) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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

const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  const label = `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;
  return { value: `${String(h).padStart(2, "0")}:00`, label };
});
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState<Set<string>>(new Set());
  const [memberAvailability, setMemberAvailability] = useState<Record<string, Record<number, { from: string; until: string }>>>({});
  const [savingAvailability, setSavingAvailability] = useState<string | null>(null);
  const [memberBlockedDates, setMemberBlockedDates] = useState<Record<string, Set<string>>>({});
  const [memberMiniDate, setMemberMiniDate] = useState<Record<string, Date>>({});
  const [memberDateInput, setMemberDateInput] = useState<Record<string, string>>({});
  const [togglingDateFor, setTogglingDateFor] = useState<string | null>(null);
  const datePickerRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

      // Fetch employee availability and blocked dates
      const [{ data: availData }, { data: blockedData }] = await Promise.all([
        supabase.from("employee_availability").select("team_member_id, day_of_week, from_time, until_time").eq("business_id", business.id),
        supabase.from("employee_blocked_dates").select("team_member_id, blocked_date").eq("business_id", business.id),
      ]);

      const availMap: Record<string, Record<number, { from: string; until: string }>> = {};
      for (const row of availData ?? []) {
        if (!availMap[row.team_member_id]) availMap[row.team_member_id] = {};
        availMap[row.team_member_id][row.day_of_week] = { from: row.from_time, until: row.until_time };
      }
      setMemberAvailability(availMap);

      const blockedMap: Record<string, Set<string>> = {};
      for (const row of blockedData ?? []) {
        if (!blockedMap[row.team_member_id]) blockedMap[row.team_member_id] = new Set();
        blockedMap[row.team_member_id].add(row.blocked_date);
      }
      setMemberBlockedDates(blockedMap);

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

  function toggleAvailDay(memberId: string, day: number) {
    setMemberAvailability((prev) => {
      const memberDays = { ...(prev[memberId] ?? {}) };
      if (memberDays[day]) {
        delete memberDays[day];
      } else {
        memberDays[day] = { from: "08:00", until: "17:00" };
      }
      return { ...prev, [memberId]: memberDays };
    });
  }

  function setAvailHour(memberId: string, day: number, field: "from" | "until", value: string) {
    setMemberAvailability((prev) => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] ?? {}),
        [day]: { ...(prev[memberId]?.[day] ?? { from: "08:00", until: "17:00" }), [field]: value },
      },
    }));
  }

  async function saveMemberAvailability(memberId: string) {
    if (!businessId) return;
    setSavingAvailability(memberId);
    const supabase = createClient();
    const days = memberAvailability[memberId] ?? {};

    await supabase.from("employee_availability").delete().eq("team_member_id", memberId);

    const rows = Object.entries(days).map(([day, hours]) => ({
      team_member_id: memberId,
      business_id: businessId,
      day_of_week: parseInt(day),
      from_time: hours.from,
      until_time: hours.until,
    }));

    if (rows.length > 0) {
      await supabase.from("employee_availability").insert(rows);
    }
    setSavingAvailability(null);
  }

  async function toggleMemberBlockedDate(memberId: string, dateStr: string) {
    if (!businessId) return;
    setTogglingDateFor(memberId);
    const supabase = createClient();
    const current = memberBlockedDates[memberId] ?? new Set<string>();
    if (current.has(dateStr)) {
      await supabase.from("employee_blocked_dates").delete().eq("team_member_id", memberId).eq("blocked_date", dateStr);
      setMemberBlockedDates((prev) => {
        const s = new Set(prev[memberId]);
        s.delete(dateStr);
        return { ...prev, [memberId]: s };
      });
    } else {
      await supabase.from("employee_blocked_dates").insert({ team_member_id: memberId, business_id: businessId, blocked_date: dateStr });
      setMemberBlockedDates((prev) => ({ ...prev, [memberId]: new Set([...(prev[memberId] ?? []), dateStr]) }));
    }
    setTogglingDateFor(null);
  }

  function applyMemberPreset(memberId: string, preset: "weekends-off" | "weekdays-off" | "all") {
    setMemberAvailability((prev) => {
      const existing = prev[memberId] ?? {};
      if (preset === "weekends-off") {
        const next = { ...existing };
        delete next[0];
        delete next[6];
        return { ...prev, [memberId]: next };
      }
      if (preset === "weekdays-off") {
        const next = { ...existing };
        [1, 2, 3, 4, 5].forEach((d) => delete next[d]);
        return { ...prev, [memberId]: next };
      }
      return {
        ...prev,
        [memberId]: Object.fromEntries(
          [0, 1, 2, 3, 4, 5, 6].map((d) => [d, existing[d] ?? { from: "08:00", until: "17:00" }])
        ),
      };
    });
  }

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-32 lg:pb-8">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Team Roster</h1>
        <p className="text-xs text-muted-foreground">Manage your crew, roles, and certifications.</p>
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
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === member.id ? null : member.id); }}
                        className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                      </button>
                      {openMenuId === member.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-border bg-background shadow-lg py-1 overflow-hidden">
                            <button
                              onClick={() => { setOpenMenuId(null); openEdit(member); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              Edit
                            </button>
                            <button
                              onClick={() => { setOpenMenuId(null); setConfirmRemoveId(member.id); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">person_remove</span>
                              Remove
                            </button>
                          </div>
                        </>
                      )}
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
                  onClick={() => setAvailabilityOpen((prev) => {
                    const next = new Set(prev);
                    next.has(member.id) ? next.delete(member.id) : next.add(member.id);
                    return next;
                  })}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 hover:bg-muted/50 ${
                    availabilityOpen.has(member.id) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">schedule</span> Hours
                </button>
                <Separator orientation="vertical" className="bg-border/50 h-auto" />
                <button
                  onClick={() => copyPortalLink(member.id)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 hover:bg-muted/50 ${
                    copiedId === member.id ? "text-[var(--color-status-completed)]" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {copiedId === member.id ? "check_circle" : "link"}
                  </span>
                  {copiedId === member.id ? "Copied!" : "Share"}
                </button>
              </div>

              {/* Per-employee availability */}
              {availabilityOpen.has(member.id) && (
                <div className="border-t border-border/50 flex flex-col">
                  {/* Preset buttons */}
                  <div className="flex gap-2 px-4 pt-3 pb-2">
                    <button
                      onClick={() => applyMemberPreset(member.id, "weekends-off")}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-bold border bg-muted/40 text-foreground border-border hover:bg-muted transition-colors"
                    >
                      Weekends Off
                    </button>
                    <button
                      onClick={() => applyMemberPreset(member.id, "weekdays-off")}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-bold border bg-muted/40 text-foreground border-border hover:bg-muted transition-colors"
                    >
                      Weekdays Off
                    </button>
                    <button
                      onClick={() => applyMemberPreset(member.id, "all")}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-bold border bg-muted/40 text-foreground border-border hover:bg-muted transition-colors"
                    >
                      All Available
                    </button>
                  </div>

                  {/* Per-day toggle rows */}
                  <div className="flex flex-col divide-y divide-border/30">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                      const isOn = !!(memberAvailability[member.id]?.[day]);
                      const hours = memberAvailability[member.id]?.[day] ?? { from: "08:00", until: "17:00" };
                      return (
                        <div key={day} className="flex items-center gap-3 px-4 py-2.5">
                          {/* Toggle */}
                          <button
                            onClick={() => toggleAvailDay(member.id, day)}
                            className={`relative shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none overflow-hidden ${
                              isOn ? "bg-primary" : "bg-border"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all duration-200 ${
                                isOn ? "left-5" : "left-0.5"
                              }`}
                            />
                          </button>

                          {/* Day label */}
                          <span className={`text-xs font-bold w-7 shrink-0 ${isOn ? "text-foreground" : "text-muted-foreground"}`}>
                            {DAY_LABELS[day]}
                          </span>

                          {/* Hours or Unavailable */}
                          {isOn ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <select
                                value={hours.from}
                                onChange={(e) => setAvailHour(member.id, day, "from", e.target.value)}
                                className="flex-1 rounded-lg border border-border bg-background px-1.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring/30"
                              >
                                {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                              </select>
                              <span className="text-muted-foreground text-xs shrink-0">→</span>
                              <select
                                value={hours.until}
                                onChange={(e) => setAvailHour(member.id, day, "until", e.target.value)}
                                className="flex-1 rounded-lg border border-border bg-background px-1.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring/30"
                              >
                                {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                              </select>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic flex-1">Unavailable</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Save */}
                  <div className="px-4 py-3">
                    <button
                      onClick={() => saveMemberAvailability(member.id)}
                      disabled={savingAvailability === member.id}
                      className="w-full rounded-xl py-2.5 text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {savingAvailability === member.id ? "Saving…" : "Save Availability"}
                    </button>
                  </div>

                  {/* Specific Dates */}
                  <div className="border-t border-border/50 px-4 py-3 flex flex-col gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Specific Dates Off</p>

                    {/* Date picker + Block button */}
                    <div className="flex gap-2">
                      <div
                        className="flex-1 flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer select-none"
                        onClick={() => {
                          const el = datePickerRefs.current[member.id];
                          if (!el) return;
                          if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
                            (el as HTMLInputElement & { showPicker: () => void }).showPicker();
                          } else {
                            el.focus();
                            el.click();
                          }
                        }}
                      >
                        <span className={`text-xs font-medium ${memberDateInput[member.id] ? "text-foreground" : "text-muted-foreground"}`}>
                          {memberDateInput[member.id]
                            ? new Date(memberDateInput[member.id] + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                            : "Pick a date to block…"}
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-muted-foreground ml-1">expand_more</span>
                        <input
                          ref={(el) => { datePickerRefs.current[member.id] = el; }}
                          type="date"
                          value={memberDateInput[member.id] ?? ""}
                          className="sr-only"
                          onChange={(e) => {
                            setMemberDateInput((prev) => ({ ...prev, [member.id]: e.target.value }));
                            if (!e.target.value) return;
                            const d = new Date(e.target.value + "T12:00:00");
                            setMemberMiniDate((prev) => ({ ...prev, [member.id]: new Date(d.getFullYear(), d.getMonth(), 1) }));
                          }}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          const val = memberDateInput[member.id];
                          if (!val) return;
                          await toggleMemberBlockedDate(member.id, val);
                          setMemberDateInput((prev) => ({ ...prev, [member.id]: "" }));
                        }}
                        disabled={!memberDateInput[member.id] || togglingDateFor === member.id}
                        className="px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-40 transition-colors shrink-0"
                      >
                        Block
                      </button>
                    </div>

                    {/* Month navigation */}
                    {(() => {
                      const miniDate = memberMiniDate[member.id] ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                      const blocked = memberBlockedDates[member.id] ?? new Set<string>();
                      const todayStr = dateKey(new Date());
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => setMemberMiniDate((prev) => ({ ...prev, [member.id]: new Date(miniDate.getFullYear(), miniDate.getMonth() - 1, 1) }))}
                              className="flex size-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                            </button>
                            <span className="text-xs font-extrabold text-foreground">
                              {MONTHS[miniDate.getMonth()]} {miniDate.getFullYear()}
                            </span>
                            <button
                              onClick={() => setMemberMiniDate((prev) => ({ ...prev, [member.id]: new Date(miniDate.getFullYear(), miniDate.getMonth() + 1, 1) }))}
                              className="flex size-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                            </button>
                          </div>

                          {/* Day headers */}
                          <div className="grid grid-cols-7">
                            {DAY_LABELS.map((d) => (
                              <div key={d} className="text-center text-[9px] font-bold uppercase text-muted-foreground py-1">{d[0]}</div>
                            ))}
                          </div>

                          {/* Calendar grid */}
                          <div className="grid grid-cols-7 gap-0.5">
                            {getCalendarDays(miniDate.getFullYear(), miniDate.getMonth()).map((day) => {
                              const key = dateKey(day);
                              const isThisMonth = day.getMonth() === miniDate.getMonth();
                              const isBlocked = blocked.has(key);
                              return (
                                <button
                                  key={key}
                                  onClick={() => isThisMonth && toggleMemberBlockedDate(member.id, key)}
                                  disabled={!isThisMonth || togglingDateFor === member.id}
                                  className={`flex items-center justify-center h-8 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                                    isBlocked
                                      ? "bg-red-500 text-white shadow-sm"
                                      : key === todayStr
                                      ? "bg-primary/10 text-primary"
                                      : !isThisMonth
                                      ? "text-muted-foreground/20 cursor-default"
                                      : "text-foreground hover:bg-muted"
                                  }`}
                                >
                                  {day.getDate()}
                                </button>
                              );
                            })}
                          </div>

                          {/* Blocked list */}
                          {blocked.size > 0 && (
                            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                              {Array.from(blocked).sort().map((d) => (
                                <div key={d} className="flex items-center justify-between px-2.5 py-1.5 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
                                  <span className="text-xs font-medium text-red-800 dark:text-red-300">
                                    {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  <button
                                    onClick={() => toggleMemberBlockedDate(member.id, d)}
                                    className="flex size-5 items-center justify-center rounded-full text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {blocked.size === 0 && (
                            <p className="text-[11px] text-muted-foreground text-center py-1">Tap any date to mark it unavailable.</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
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

      {/* Remove Confirmation Modal */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmRemoveId(null)} />
          <div className="relative w-full max-w-sm bg-background rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                <span className="material-symbols-outlined text-[28px] text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-foreground">Remove Member?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-semibold text-foreground">{members.find((m) => m.id === confirmRemoveId)?.name}</span> will be removed from your team. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleRemove(confirmRemoveId);
                  setConfirmRemoveId(null);
                }}
                disabled={deletingId === confirmRemoveId}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deletingId === confirmRemoveId ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
