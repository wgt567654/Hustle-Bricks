"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_role: "owner" | "employee";
  content: string;
  created_at: string;
  message_type: string;
  metadata: Record<string, unknown> | null;
  media_url: string | null;
  is_read: boolean;
  isBroadcast?: boolean;
};

type TodayJob = {
  id: string;
  service_type: string | null;
  scheduled_at: string | null;
  status: string;
  clients: { name: string; address: string | null } | null;
};

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  }
  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-muted/60 min-w-[160px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button onClick={toggle} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>
      <div className="flex flex-col flex-1 gap-1">
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }} />
        </div>
        <span className="text-[10px] text-muted-foreground">{fmt(duration > 0 ? progress : 0)} / {fmt(duration)}</span>
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = { scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed" };
const STATUS_COLORS: Record<string, string> = { scheduled: "text-blue-500", in_progress: "text-amber-500", completed: "text-green-500" };

function mStr(v: unknown, fallback = ""): string { return typeof v === "string" ? v : fallback; }
function mNum(v: unknown, fallback = 0): number { return typeof v === "number" ? v : fallback; }

function RichCard({ msg }: { msg: Message }) {
  const meta = msg.metadata ?? {};

  if (msg.message_type === "photo" && msg.media_url) {
    return (
      <img
        src={msg.media_url}
        alt="Photo"
        className="rounded-2xl max-w-[220px] max-h-48 object-cover cursor-pointer"
        onClick={() => window.open(msg.media_url!, "_blank")}
      />
    );
  }

  if (msg.message_type === "voice" && msg.media_url) {
    return <AudioPlayer src={msg.media_url} />;
  }

  if (msg.message_type === "job_card") {
    const assigned = !!meta.assigned;
    const status = mStr(meta.status);
    return (
      <div className="rounded-2xl border border-border/60 bg-background overflow-hidden min-w-[200px] max-w-[240px]">
        {assigned && (
          <div className="bg-primary/10 px-3 py-1.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-primary">assignment_ind</span>
            <span className="text-[11px] font-semibold text-primary">Assigned to you</span>
          </div>
        )}
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          <div className="flex items-start gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-muted-foreground mt-0.5">build</span>
            <span className="font-semibold text-sm text-foreground leading-tight">{mStr(meta.service_type, "Job")}</span>
          </div>
          {!!meta.client_name && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-muted-foreground">person</span>
              <span className="text-xs text-muted-foreground">{mStr(meta.client_name)}</span>
            </div>
          )}
          {!!meta.scheduled_at && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-muted-foreground">calendar_month</span>
              <span className="text-xs text-muted-foreground">
                {new Date(mStr(meta.scheduled_at)).toLocaleDateString([], { month: "short", day: "numeric" })} · {new Date(mStr(meta.scheduled_at)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          )}
          {meta.total != null && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-muted-foreground">attach_money</span>
              <span className="text-xs text-muted-foreground">${mNum(meta.total).toFixed(0)}</span>
            </div>
          )}
          {status && (
            <span className={`text-[11px] font-semibold ${STATUS_COLORS[status] ?? "text-muted-foreground"}`}>
              ● {STATUS_LABELS[status] ?? status}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (msg.message_type === "lead_card") {
    return (
      <div className="rounded-2xl border border-border/60 bg-background overflow-hidden min-w-[200px] max-w-[240px]">
        <div className="bg-green-500/10 px-3 py-1.5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-green-600">person_add</span>
          <span className="text-[11px] font-semibold text-green-600">Lead Shared</span>
        </div>
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          <span className="font-semibold text-sm text-foreground">{mStr(meta.name)}</span>
          {!!meta.address && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-muted-foreground">location_on</span>
              <span className="text-xs text-muted-foreground">{mStr(meta.address)}</span>
            </div>
          )}
          {!!meta.phone && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-muted-foreground">call</span>
              <span className="text-xs text-muted-foreground">{mStr(meta.phone)}</span>
            </div>
          )}
          {meta.estimated_value != null && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-muted-foreground">attach_money</span>
              <span className="text-xs text-muted-foreground">Est. ${mNum(meta.estimated_value).toFixed(0)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.message_type === "commission_summary") {
    return (
      <div className="rounded-2xl border border-border/60 bg-background overflow-hidden min-w-[200px] max-w-[240px]">
        <div className="bg-primary/10 px-3 py-1.5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-primary">bar_chart</span>
          <span className="text-[11px] font-semibold text-primary">Commission Summary</span>
        </div>
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{mStr(meta.period)}</span>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Jobs completed</span>
            <span className="font-semibold text-foreground">{mNum(meta.jobs_count)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Revenue</span>
            <span className="font-semibold text-foreground">${mNum(meta.revenue).toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-1.5 mt-0.5">
            <span>Your commission ({mNum(meta.rate)}%)</span>
            <span className="font-extrabold text-primary">${mNum(meta.commission).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (msg.message_type === "schedule_share") {
    const jobs = Array.isArray(meta.jobs) ? (meta.jobs as { id: string; service_type: string; scheduled_at: string }[]) : [];
    return (
      <div className="rounded-2xl border border-border/60 bg-background overflow-hidden min-w-[200px] max-w-[260px]">
        <div className="bg-muted px-3 py-1.5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-muted-foreground">calendar_month</span>
          <span className="text-[11px] font-semibold text-muted-foreground">Schedule Shared</span>
        </div>
        <div className="px-3 py-2 flex flex-col gap-1">
          {jobs.length === 0 && <span className="text-xs text-muted-foreground italic">No jobs today</span>}
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-2 text-xs text-foreground">
              <span className="text-muted-foreground shrink-0">
                {new Date(j.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="truncate">{j.service_type}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default function EmployeeMessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [broadcasts, setBroadcasts] = useState<Message[]>([]);
  const [todayJobs, setTodayJobs] = useState<TodayJob[]>([]);
  const [myGroups, setMyGroups] = useState<{ id: string; name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notApproved, setNotApproved] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Plus sheet (photo / lead)
  const [showPlusSheet, setShowPlusSheet] = useState(false);

  // Lead form
  const [showLeadSheet, setShowLeadSheet] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadAddress, setLeadAddress] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadValue, setLeadValue] = useState("");
  const [submittingLead, setSubmittingLead] = useState(false);

  // Job done picker
  const [showJobDoneSheet, setShowJobDoneSheet] = useState(false);
  const [activeJobs, setActiveJobs] = useState<TodayJob[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id, business_id, is_active")
        .eq("user_id", user.id)
        .single();
      if (cancelled) return;
      if (!tm) { setLoading(false); return; }
      if (!(tm as unknown as { is_active: boolean }).is_active) {
        setNotApproved(true);
        setLoading(false);
        return;
      }
      const tmId = tm.id;
      const bizId = (tm as unknown as { business_id: string }).business_id;
      setTeamMemberId(tmId);
      setBusinessId(bizId);

      // Fetch messages, broadcasts, and today's jobs in parallel
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const [{ data: msgData }, { data: broadcastData }, { data: jobsData }, { data: groupData }] = await Promise.all([
        supabase
          .from("team_messages")
          .select("id, sender_role, content, created_at, message_type, metadata, media_url, is_read")
          .eq("team_member_id", tmId)
          .order("created_at", { ascending: true }),
        supabase
          .from("team_broadcasts")
          .select("id, content, created_at")
          .eq("business_id", bizId)
          .order("created_at", { ascending: true }),
        supabase
          .from("jobs")
          .select("id, service_type, scheduled_at, status, clients(name, address)")
          .eq("assigned_member_id", tmId)
          .gte("scheduled_at", startOfDay)
          .lte("scheduled_at", endOfDay)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("team_group_members")
          .select("group_id, team_groups(id, name, type)")
          .eq("team_member_id", tmId),
      ]);
      if (cancelled) return;

      setMessages((msgData ?? []) as Message[]);
      setBroadcasts(
        ((broadcastData ?? []) as { id: string; content: string; created_at: string }[]).map((b) => ({
          id: b.id,
          sender_role: "owner" as const,
          content: b.content,
          created_at: b.created_at,
          message_type: "text",
          metadata: null,
          media_url: null,
          is_read: true,
          isBroadcast: true,
        }))
      );
      setTodayJobs((jobsData ?? []) as unknown as TodayJob[]);
      setMyGroups(
        ((groupData ?? []) as unknown as { team_groups: { id: string; name: string; type: string } }[])
          .map((g) => g.team_groups)
          .filter(Boolean)
      );
      setLoading(false);

      // Mark owner messages as read
      supabase
        .from("team_messages")
        .update({ is_read: true })
        .eq("team_member_id", tmId)
        .eq("sender_role", "owner")
        .eq("is_read", false)
        .then(() => {});

      // Subscribe to new team messages
      supabase
        .channel(`team-messages-${tmId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "team_messages", filter: `team_member_id=eq.${tmId}` },
          (payload) => {
            if (cancelled) return;
            setMessages((prev) => {
              const msg = payload.new as Message;
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        )
        .subscribe();

      // Subscribe to new broadcasts for this business
      supabase
        .channel(`team-broadcasts-${bizId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "team_broadcasts", filter: `business_id=eq.${bizId}` },
          (payload) => {
            if (cancelled) return;
            const b = payload.new as { id: string; content: string; created_at: string };
            setBroadcasts((prev) => {
              if (prev.some((m) => m.id === b.id)) return prev;
              return [...prev, {
                id: b.id,
                sender_role: "owner" as const,
                content: b.content,
                created_at: b.created_at,
                message_type: "text",
                metadata: null,
                media_url: null,
                is_read: true,
                isBroadcast: true,
              }];
            });
          }
        )
        .subscribe();
    }
    load();

    return () => {
      cancelled = true;
      supabase.removeAllChannels();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, broadcasts]);

  // Merge messages and broadcasts into a single sorted timeline
  const timeline = useMemo(() => {
    return [...messages, ...broadcasts].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, broadcasts]);

  async function sendMessage(content: string, type = "text", metadata?: Record<string, unknown>, mediaUrl?: string) {
    if (!teamMemberId || !businessId || !content.trim() || sending) return;
    setSending(true);
    setSendError(false);
    const supabase = createClient();
    const { data: inserted, error } = await supabase
      .from("team_messages")
      .insert({
        team_member_id: teamMemberId,
        business_id: businessId,
        sender_role: "employee",
        content,
        message_type: type,
        metadata: metadata ?? null,
        media_url: mediaUrl ?? null,
        is_read: false,
      })
      .select("id, sender_role, content, created_at, message_type, metadata, media_url, is_read")
      .single();
    if (error) {
      setSendError(true);
    } else if (inserted) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === (inserted as Message).id)) return prev;
        return [...prev, inserted as Message];
      });
    }
    setSending(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !businessId || !teamMemberId) return;
    setShowPlusSheet(false);
    setUploadingPhoto(true);
    const supabase = createClient();
    const path = `${businessId}/${teamMemberId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file, { upsert: false });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path);
      await sendMessage("", "photo", undefined, publicUrl);
    }
    setUploadingPhoto(false);
    e.target.value = "";
  }

  async function handleMySchedule() {
    const jobs = todayJobs.map((j) => ({
      id: j.id,
      service_type: j.service_type ?? "Job",
      scheduled_at: j.scheduled_at ?? new Date().toISOString(),
    }));
    await sendMessage("My schedule today", "schedule_share", { jobs });
  }

  async function handleJobDoneChip() {
    if (!teamMemberId) return;
    const supabase = createClient();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    const { data } = await supabase
      .from("jobs")
      .select("id, service_type, scheduled_at, status, clients(name, address)")
      .eq("assigned_member_id", teamMemberId)
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", startOfDay)
      .lte("scheduled_at", endOfDay)
      .order("scheduled_at");

    const jobs = (data ?? []) as unknown as TodayJob[];

    if (jobs.length === 0) {
      await sendMessage("Job done ✅", "quick_reply");
    } else if (jobs.length === 1) {
      setActiveJobs(jobs);
      setShowJobDoneSheet(true);
    } else {
      setActiveJobs(jobs);
      setShowJobDoneSheet(true);
    }
  }

  async function confirmJobDone(job: TodayJob) {
    setShowJobDoneSheet(false);
    const supabase = createClient();
    await Promise.all([
      supabase.from("jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id),
      sendMessage("Job done ✅", "quick_reply"),
    ]);
  }

  async function submitLead() {
    if (!leadName.trim() || !leadAddress.trim() || !businessId || !teamMemberId || submittingLead) return;
    setSubmittingLead(true);
    const supabase = createClient();
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        business_id: businessId,
        name: leadName.trim(),
        address: leadAddress.trim(),
        phone: leadPhone.trim() || null,
        estimated_value: leadValue ? parseFloat(leadValue) : null,
        stage: "new",
        source: "Team Chat",
      })
      .select("id")
      .single();

    if (!error && lead) {
      await sendMessage(
        leadName.trim(),
        "lead_card",
        {
          lead_id: lead.id,
          name: leadName.trim(),
          address: leadAddress.trim(),
          phone: leadPhone.trim() || null,
          estimated_value: leadValue ? parseFloat(leadValue) : null,
        }
      );
      setLeadName(""); setLeadAddress(""); setLeadPhone(""); setLeadValue("");
      setShowLeadSheet(false);
    }
    setSubmittingLead(false);
  }

  async function startRecording() {
    if (!businessId || !teamMemberId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      // Mic permission denied or unavailable
    }
  }

  async function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr || !businessId || !teamMemberId) return;
    setRecording(false);
    setUploadingVoice(true);
    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    });
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const supabase = createClient();
    const path = `${businessId}/${teamMemberId}/voice_${Date.now()}.webm`;
    const { error } = await supabase.storage.from("chat-media").upload(path, blob, { upsert: false, contentType: "audio/webm" });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path);
      await sendMessage("", "voice", undefined, publicUrl);
    }
    setUploadingVoice(false);
    audioChunksRef.current = [];
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) { sendMessage(text.trim()); setText(""); }
    }
  }

  const showQuickReplies = text.trim() === "";

  return (
    <div className="flex flex-col h-[calc(100svh-3.5rem-env(safe-area-inset-bottom,0px)-3.75rem)] max-w-xl mx-auto">

      {/* Header */}
      <div className="px-4 py-4 border-b border-border/50 shrink-0">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Messages</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Direct line to your manager</p>
      </div>

      {/* My Groups */}
      {!loading && !notApproved && myGroups.length > 0 && (
        <div className="mx-4 mt-3 flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">My Groups</span>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {myGroups.map((grp) => (
              <button
                key={grp.id}
                onClick={() => router.push(`/employee/messages/groups/${grp.id}`)}
                className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-2xl bg-muted/60 border border-border/40 hover:bg-muted active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">{grp.type === "territory" ? "pin_drop" : "group"}</span>
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{grp.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today's schedule banner */}
      {!loading && !notApproved && todayJobs.length > 0 && (
        <button
          onClick={() => setScheduleOpen(!scheduleOpen)}
          className="mx-4 mt-3 px-3.5 py-2.5 rounded-2xl bg-muted/60 border border-border/40 flex flex-col gap-1 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
              <span className="text-xs font-bold text-foreground">Today&apos;s Schedule</span>
              <span className="text-xs text-muted-foreground">({todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""})</span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-muted-foreground">{scheduleOpen ? "expand_less" : "expand_more"}</span>
          </div>
          {(scheduleOpen ? todayJobs : todayJobs.slice(0, 2)).map((job) => {
            const client = job.clients as { name: string; address: string | null } | null;
            return (
              <div key={job.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-0.5">
                <span className="shrink-0 font-medium text-foreground">
                  {job.scheduled_at ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}
                </span>
                <span className="truncate">{job.service_type ?? "Job"}{client ? ` · ${client.name}` : ""}</span>
              </div>
            );
          })}
          {!scheduleOpen && todayJobs.length > 2 && (
            <span className="text-xs text-primary font-semibold pl-0.5">+{todayJobs.length - 2} more</span>
          )}
        </button>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
        )}

        {!loading && notApproved && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">pending</span>
            <p className="text-sm font-semibold text-muted-foreground">Approval pending</p>
            <p className="text-xs text-muted-foreground/60">Messaging will be available once your manager approves your account.</p>
          </div>
        )}

        {!loading && !notApproved && timeline.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">chat</span>
            <p className="text-sm font-semibold text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60">Send a message to your manager below</p>
          </div>
        )}

        {timeline.map((msg) => {
          const isMe = msg.sender_role === "employee";
          const isBroadcast = msg.isBroadcast === true;
          const isRich = ["photo", "voice", "job_card", "lead_card", "commission_summary", "schedule_share"].includes(msg.message_type);
          const isQuickReply = msg.message_type === "quick_reply";

          if (isBroadcast) {
            return (
              <div key={msg.id} className="flex flex-col items-stretch gap-1 my-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">campaign</span>
                    Team Message
                  </span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl bg-muted/80 text-foreground text-sm leading-relaxed border border-border/30">
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground/50 px-1">{formatMsgTime(msg.created_at)}</span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                {isQuickReply && isMe && (
                  <span className="text-[10px] text-primary/70 font-semibold px-1">Quick Reply</span>
                )}
                {isRich ? (
                  <RichCard msg={msg} />
                ) : (
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground/50 px-1">
                  {isMe ? "You" : "Manager"} · {formatMsgTime(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pt-2 pb-3 border-t border-border/50 shrink-0 flex flex-col gap-1.5">
        {sendError && (
          <p className="text-xs text-red-500 px-1">Failed to send. Please try again.</p>
        )}

        {/* Quick reply chips */}
        {showQuickReplies && !notApproved && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { label: "On my way 🚗", action: () => sendMessage("On my way 🚗", "quick_reply") },
              { label: "Running late ⏰", action: () => sendMessage("Running late ⏰", "quick_reply") },
              { label: "At location 📍", action: () => sendMessage("At location 📍", "quick_reply") },
              { label: "My Schedule 📅", action: handleMySchedule },
              { label: "Job done ✅", action: handleJobDoneChip },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                disabled={sending || !teamMemberId}
                className="shrink-0 px-3 py-1.5 rounded-full border border-border bg-muted/40 text-xs font-medium text-foreground hover:bg-muted active:scale-95 transition-all disabled:opacity-40 whitespace-nowrap"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />

          {/* Plus button (photo / lead) */}
          <button
            onClick={() => setShowPlusSheet(true)}
            disabled={notApproved || !teamMemberId}
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 transition-colors"
          >
            {uploadingPhoto
              ? <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-[20px]">add</span>
            }
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your manager…"
            rows={1}
            disabled={notApproved}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32 overflow-y-auto disabled:opacity-50"
            style={{ lineHeight: "1.5" }}
          />
          {text.trim() ? (
            <button
              onClick={() => { sendMessage(text.trim()); setText(""); }}
              disabled={sending || notApproved}
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white disabled:opacity-40 active:scale-90 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={uploadingVoice || notApproved || !teamMemberId}
              className={`flex size-10 shrink-0 items-center justify-center rounded-2xl transition-all disabled:opacity-40 ${recording ? "bg-red-500 text-white scale-110" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {uploadingVoice
                ? <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-[20px]" style={recording ? { fontVariationSettings: "'FILL' 1" } : {}}>mic</span>
              }
            </button>
          )}
        </div>
      </div>

      {/* Plus sheet (photo / lead) */}
      {showPlusSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPlusSheet(false)} />
          <div className="relative bg-background rounded-t-3xl p-5 flex flex-col gap-2 max-w-xl w-full mx-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-extrabold text-base text-foreground">Add to message</h2>
              <button onClick={() => setShowPlusSheet(false)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <button
              onClick={() => { setShowPlusSheet(false); fileInputRef.current?.click(); }}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted/60 hover:bg-muted active:bg-muted/80 transition-colors text-left"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                <span className="material-symbols-outlined text-[20px] text-blue-500">photo_camera</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Photo</p>
                <p className="text-xs text-muted-foreground">Take a photo or choose from your library</p>
              </div>
            </button>
            <button
              onClick={() => { setShowPlusSheet(false); setShowLeadSheet(true); }}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted/60 hover:bg-muted active:bg-muted/80 transition-colors text-left"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                <span className="material-symbols-outlined text-[20px] text-green-600">person_add</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Share a Lead</p>
                <p className="text-xs text-muted-foreground">Send a new prospect to your manager</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Lead form sheet */}
      {showLeadSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLeadSheet(false)} />
          <div className="relative bg-background rounded-t-3xl p-5 flex flex-col gap-4 max-w-xl w-full mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base text-foreground">Share a Lead</h2>
              <button onClick={() => setShowLeadSheet(false)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Name *</label>
                <input
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Address *</label>
                <input
                  value={leadAddress}
                  onChange={(e) => setLeadAddress(e.target.value)}
                  placeholder="123 Main St"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Phone (optional)</label>
                <input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  type="tel"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Estimated value (optional)</label>
                <input
                  value={leadValue}
                  onChange={(e) => setLeadValue(e.target.value)}
                  placeholder="500"
                  type="number"
                  min="0"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <button
              onClick={submitLead}
              disabled={!leadName.trim() || !leadAddress.trim() || submittingLead}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-40 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              {submittingLead ? "Sharing…" : "Share Lead"}
            </button>
          </div>
        </div>
      )}

      {/* Job done picker */}
      {showJobDoneSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowJobDoneSheet(false)} />
          <div className="relative bg-background rounded-t-3xl p-5 flex flex-col gap-3 max-w-xl w-full mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-base text-foreground">Which job did you complete?</h2>
                <p className="text-xs text-muted-foreground mt-0.5">This will also update the job status</p>
              </div>
              <button onClick={() => setShowJobDoneSheet(false)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {activeJobs.map((job) => {
              const client = job.clients as { name: string } | null;
              return (
                <button
                  key={job.id}
                  onClick={() => confirmJobDone(job)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted active:bg-muted/80 transition-colors text-left"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                    <span className="material-symbols-outlined text-[18px] text-green-600">check_circle</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm text-foreground">{job.service_type ?? "Job"}</span>
                    {client && <span className="text-xs text-muted-foreground">{client.name}</span>}
                    {job.scheduled_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => { setShowJobDoneSheet(false); sendMessage("Job done ✅", "quick_reply"); }}
              className="text-xs text-muted-foreground text-center py-2"
            >
              Just send the message without updating a job
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
