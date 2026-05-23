"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
};

type MemberInfo = {
  id: string;
  name: string;
  role: string;
  business_id: string;
  commission_rate: number | null;
};

type JobOption = {
  id: string;
  service_type: string | null;
  scheduled_at: string | null;
  status: string;
  total: number | null;
  clients: { name: string } | null;
};

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const ROLE_LABELS: Record<string, string> = { admin: "Admin", member: "Member", sales: "Sales" };
const STATUS_LABELS: Record<string, string> = { scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" };
const STATUS_COLORS: Record<string, string> = { scheduled: "text-blue-500", in_progress: "text-amber-500", completed: "text-green-500", cancelled: "text-red-500" };

function mStr(v: unknown, fallback = ""): string { return typeof v === "string" ? v : fallback; }
function mNum(v: unknown, fallback = 0): number { return typeof v === "number" ? v : fallback; }

function RichCard({ msg, onOpenJob, onOpenLead }: {
  msg: Message;
  onOpenJob?: (jobId: string) => void;
  onOpenLead?: (leadId: string) => void;
}) {
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
    const jobId = mStr(meta.job_id);
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
          {jobId && onOpenJob && (
            <button
              onClick={() => onOpenJob(jobId)}
              className="mt-1 flex items-center justify-end gap-1 text-xs text-primary font-semibold"
            >
              Open <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (msg.message_type === "lead_card") {
    const leadId = mStr(meta.lead_id);
    return (
      <div className="rounded-2xl border border-border/60 bg-background overflow-hidden min-w-[200px] max-w-[240px]">
        <div className="bg-green-500/10 px-3 py-1.5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-green-600">person_add</span>
          <span className="text-[11px] font-semibold text-green-600">New Lead</span>
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
          {leadId && onOpenLead && (
            <button
              onClick={() => onOpenLead(leadId)}
              className="mt-1 flex items-center justify-end gap-1 text-xs text-primary font-semibold"
            >
              Open Lead <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
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
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">{fmt(duration > 0 ? progress : 0)} / {fmt(duration)}</span>
      </div>
    </div>
  );
}

export default function MemberThreadPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.memberId as string;

  const [member, setMember] = useState<MemberInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Attach sheet
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  // Job picker
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [assignJob, setAssignJob] = useState(false);
  const [sendingJob, setSendingJob] = useState(false);
  // Commission
  const [sendingCommission, setSendingCommission] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id, commission_rate")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled || !business) { setLoading(false); return; }

      const { data: tm } = await supabase
        .from("team_members")
        .select("id, name, role, commission_rate")
        .eq("id", memberId)
        .eq("business_id", business.id)
        .single();
      if (cancelled || !tm) { setLoading(false); return; }

      setMember({
        id: tm.id,
        name: tm.name,
        role: tm.role,
        business_id: business.id,
        commission_rate: (tm as unknown as { commission_rate: number | null }).commission_rate
          ?? (business as unknown as { commission_rate: number | null }).commission_rate,
      });

      const { data } = await supabase
        .from("team_messages")
        .select("id, sender_role, content, created_at, message_type, metadata, media_url, is_read")
        .eq("team_member_id", memberId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data ?? []) as Message[]);
      setLoading(false);

      // Mark employee messages as read
      supabase.from("team_messages")
        .update({ is_read: true })
        .eq("team_member_id", memberId)
        .eq("sender_role", "employee")
        .eq("is_read", false)
        .then(() => {});

      supabase
        .channel(`owner-thread-${memberId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "team_messages", filter: `team_member_id=eq.${memberId}` },
          (payload) => {
            if (cancelled) return;
            const msg = payload.new as Message;
            if (msg.sender_role === "employee") {
              setMessages((prev) => [...prev, msg]);
              // Mark incoming employee messages read immediately
              const supabase2 = createClient();
              supabase2.from("team_messages").update({ is_read: true }).eq("id", msg.id).then(() => {});
            }
          }
        )
        .subscribe();
    }
    load();
    return () => { cancelled = true; };
  }, [memberId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content: string, type = "text", metadata?: Record<string, unknown>, mediaUrl?: string) {
    if (!member || !content.trim() || sending) return;
    setSending(true);
    const supabase = createClient();
    const { data: inserted } = await supabase
      .from("team_messages")
      .insert({
        team_member_id: memberId,
        business_id: member.business_id,
        sender_role: "owner",
        content,
        message_type: type,
        metadata: metadata ?? null,
        media_url: mediaUrl ?? null,
        is_read: false,
      })
      .select("id, sender_role, content, created_at, message_type, metadata, media_url, is_read")
      .single();
    if (inserted) setMessages((prev) => [...prev, inserted as Message]);
    setSending(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !member) return;
    setUploadingPhoto(true);
    const supabase = createClient();
    const path = `${member.business_id}/${memberId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file, { upsert: false });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path);
      await sendMessage("", "photo", undefined, publicUrl);
    }
    setUploadingPhoto(false);
    e.target.value = "";
  }

  async function openJobPicker() {
    if (!member) return;
    setShowAttachSheet(false);
    const supabase = createClient();
    const { data } = await supabase
      .from("jobs")
      .select("id, service_type, scheduled_at, status, total, clients(name)")
      .eq("business_id", member.business_id)
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true })
      .limit(50);
    setJobs((data ?? []) as unknown as JobOption[]);
    setJobSearch("");
    setAssignJob(false);
    setShowJobPicker(true);
  }

  async function shareJob(job: JobOption) {
    if (!member || sendingJob) return;
    setSendingJob(true);
    const supabase = createClient();

    if (assignJob) {
      await Promise.all([
        supabase.from("jobs").update({ assigned_member_id: memberId }).eq("id", job.id),
        supabase.from("job_crew").upsert({ job_id: job.id, team_member_id: memberId }),
      ]);
    }

    const clientName = (job.clients as { name: string } | null)?.name ?? null;
    await sendMessage(
      job.service_type ?? "Job",
      "job_card",
      {
        job_id: job.id,
        service_type: job.service_type ?? "Job",
        scheduled_at: job.scheduled_at,
        status: job.status,
        total: job.total,
        client_name: clientName,
        assigned: assignJob,
      }
    );
    setSendingJob(false);
    setShowJobPicker(false);
  }

  async function sendCommissionSummary() {
    if (!member || sendingCommission) return;
    setSendingCommission(true);
    setShowAttachSheet(false);
    const supabase = createClient();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const period = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const { data: completedJobs } = await supabase
      .from("jobs")
      .select("id, total")
      .eq("assigned_member_id", memberId)
      .eq("status", "completed")
      .gte("completed_at", monthStart)
      .lte("completed_at", monthEnd);

    const jobs = (completedJobs ?? []) as { id: string; total: number }[];
    const revenue = jobs.reduce((s, j) => s + (j.total ?? 0), 0);
    const rate = member.commission_rate ?? 0;
    const commission = (revenue * rate) / 100;

    await sendMessage(
      "Commission Summary",
      "commission_summary",
      { period, jobs_count: jobs.length, revenue, commission, rate }
    );
    setSendingCommission(false);
  }

  async function startRecording() {
    if (!member) return;
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
    if (!mr || !member) return;
    setRecording(false);
    setUploadingVoice(true);
    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    });
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const supabase = createClient();
    const path = `${member.business_id}/${memberId}/voice_${Date.now()}.webm`;
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
      if (text.trim()) {
        sendMessage(text.trim());
        setText("");
      }
    }
  }

  const filteredJobs = jobs.filter((j) => {
    const q = jobSearch.toLowerCase();
    const clientName = (j.clients as { name: string } | null)?.name ?? "";
    return !q || (j.service_type?.toLowerCase().includes(q) ?? false) || clientName.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-[calc(100svh-3.5rem-env(safe-area-inset-bottom,0px)-3.75rem)] max-w-xl mx-auto lg:h-[100svh]">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 shrink-0">
        <button
          onClick={() => router.push("/messages")}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors -ml-1"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        {member && (
          <>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-extrabold">
              {getInitials(member.name)}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-bold text-sm text-foreground leading-tight">{member.name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role] ?? member.role}</span>
            </div>
          </>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">chat</span>
            <p className="text-sm font-semibold text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60">Send a message to {member?.name?.split(" ")[0] ?? "them"} below</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_role === "owner";
          const isRich = ["photo", "voice", "job_card", "lead_card", "commission_summary", "schedule_share"].includes(msg.message_type);
          const isQuickReply = msg.message_type === "quick_reply";
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                {isQuickReply && !isMe && (
                  <span className="text-[10px] text-primary/70 font-semibold px-1">Quick Reply</span>
                )}
                {isRich ? (
                  <RichCard
                    msg={msg}
                    onOpenJob={(id) => router.push(`/jobs/${id}`)}
                    onOpenLead={(id) => router.push(`/leads/${id}`)}
                  />
                ) : (
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                    {msg.content}
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground/50 px-1">
                  {isMe ? "You" : member?.name?.split(" ")[0] ?? "Employee"} · {formatMsgTime(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pt-2 pb-3 border-t border-border/50 shrink-0">
        <div className="flex items-end gap-2">
          {/* Photo upload */}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto || !member}
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 transition-colors"
          >
            {uploadingPhoto
              ? <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            }
          </button>

          {/* Attach (job/commission) */}
          <button
            onClick={() => setShowAttachSheet(true)}
            disabled={!member}
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">attach_file</span>
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${member?.name?.split(" ")[0] ?? "team member"}…`}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          {text.trim() ? (
            <button
              onClick={() => { sendMessage(text.trim()); setText(""); }}
              disabled={sending}
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
              disabled={uploadingVoice || !member}
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

      {/* Attach sheet */}
      {showAttachSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAttachSheet(false)} />
          <div className="relative bg-background rounded-t-3xl p-5 flex flex-col gap-2 max-w-xl w-full mx-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-extrabold text-base text-foreground">Attach</h2>
              <button onClick={() => setShowAttachSheet(false)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <button
              onClick={openJobPicker}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted/60 hover:bg-muted active:bg-muted/80 transition-colors text-left"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                <span className="material-symbols-outlined text-[20px] text-blue-500">build</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Share a Job</p>
                <p className="text-xs text-muted-foreground">Link a job card · optionally assign to {member?.name?.split(" ")[0] ?? "them"}</p>
              </div>
            </button>
            <button
              onClick={sendCommissionSummary}
              disabled={sendingCommission}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted/60 hover:bg-muted active:bg-muted/80 transition-colors text-left disabled:opacity-40"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-[20px] text-primary">bar_chart</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Send Commission Summary</p>
                <p className="text-xs text-muted-foreground">This month&apos;s earnings for {member?.name?.split(" ")[0] ?? "them"}</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Job picker */}
      {showJobPicker && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowJobPicker(false)} />
          <div className="relative bg-background rounded-t-3xl flex flex-col max-h-[80vh] max-w-xl w-full mx-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <h2 className="font-extrabold text-base text-foreground">Share a Job</h2>
              <button onClick={() => setShowJobPicker(false)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="px-5 pb-3 shrink-0">
              <input
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search jobs…"
                className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {/* Assign toggle */}
            <div className="px-5 pb-3 shrink-0 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Assign to {member?.name?.split(" ")[0]}</p>
                <p className="text-xs text-muted-foreground">Also sets them as the primary assignee</p>
              </div>
              <button
                onClick={() => setAssignJob(!assignJob)}
                className={`relative w-11 h-6 rounded-full transition-colors ${assignJob ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${assignJob ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-5 flex flex-col gap-2">
              {filteredJobs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No upcoming jobs found</p>
              )}
              {filteredJobs.map((job) => {
                const clientName = (job.clients as { name: string } | null)?.name;
                return (
                  <button
                    key={job.id}
                    onClick={() => shareJob(job)}
                    disabled={sendingJob}
                    className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-muted/40 hover:bg-muted active:bg-muted/80 transition-colors text-left disabled:opacity-40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 mt-0.5">
                      <span className="material-symbols-outlined text-[18px] text-blue-500">build</span>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground">{job.service_type ?? "Job"}</span>
                      {clientName && <span className="text-xs text-muted-foreground">{clientName}</span>}
                      {job.scheduled_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(job.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric" })} · {new Date(job.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      {job.total != null && <span className="text-xs text-muted-foreground">${job.total.toFixed(0)}</span>}
                    </div>
                    <span className={`text-[11px] font-semibold shrink-0 ${STATUS_COLORS[job.status] ?? "text-muted-foreground"}`}>
                      {STATUS_LABELS[job.status] ?? job.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
