"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type GroupMessage = {
  id: string;
  sender_role: "owner" | "employee";
  sender_member_id: string | null;
  content: string;
  created_at: string;
  message_type: string;
  media_url: string | null;
};

type GroupInfo = {
  id: string;
  name: string;
  type: string;
  business_id: string;
  member_count: number;
};

type MemberName = { id: string; name: string };

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
    if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); }
  }
  function fmt(s: number) {
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-muted/60 min-w-[160px]">
      <audio ref={audioRef} src={src}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
      <button onClick={toggle} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>
      <div className="flex flex-col flex-1 gap-1">
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }} />
        </div>
        <span className="text-[10px] text-muted-foreground">{fmt(progress)} / {fmt(duration)}</span>
      </div>
    </div>
  );
}

export default function OwnerGroupThreadPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const { data: business } = await supabase.from("businesses").select("id")
        .eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
      if (cancelled || !business) { setLoading(false); return; }

      const [{ data: grp }, { data: membersData }, { data: msgData }] = await Promise.all([
        supabase.from("team_groups").select("id, name, type").eq("id", groupId).eq("business_id", business.id).single(),
        supabase.from("team_group_members").select("team_member_id, team_members(id, name)").eq("group_id", groupId),
        supabase.from("team_group_messages").select("id, sender_role, sender_member_id, content, created_at, message_type, media_url")
          .eq("group_id", groupId).order("created_at", { ascending: true }),
      ]);
      if (cancelled || !grp) { setLoading(false); return; }

      const members = (membersData ?? []) as unknown as { team_members: MemberName }[];
      const names: Record<string, string> = {};
      for (const m of members) { if (m.team_members) names[m.team_members.id] = m.team_members.name; }

      setGroup({ id: grp.id, name: grp.name, type: grp.type, business_id: business.id, member_count: members.length });
      setMemberNames(names);
      setMessages((msgData ?? []) as GroupMessage[]);
      setLoading(false);

      supabase.channel(`group-messages-${groupId}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "team_group_messages", filter: `group_id=eq.${groupId}` },
          (payload) => {
            if (cancelled) return;
            const msg = payload.new as GroupMessage;
            if (msg.sender_role === "employee") {
              setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
            }
          })
        .subscribe();
    }
    load();
    return () => { cancelled = true; };
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content: string, type = "text", mediaUrl?: string) {
    if (!group || (!content.trim() && !mediaUrl) || sending) return;
    setSending(true);
    const supabase = createClient();
    const { data: inserted } = await supabase.from("team_group_messages")
      .insert({ group_id: groupId, business_id: group.business_id, sender_role: "owner", content, message_type: type, media_url: mediaUrl ?? null })
      .select("id, sender_role, sender_member_id, content, created_at, message_type, media_url")
      .single();
    if (inserted) setMessages((prev) => [...prev, inserted as GroupMessage]);
    setSending(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !group) return;
    setUploadingPhoto(true);
    const supabase = createClient();
    const path = `groups/${groupId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file, { upsert: false });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path);
      await sendMessage("", "photo", publicUrl);
    }
    setUploadingPhoto(false);
    e.target.value = "";
  }

  async function startRecording() {
    if (!group) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch { /* mic unavailable */ }
  }

  async function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr || !group) return;
    setRecording(false);
    setUploadingVoice(true);
    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); mr.stream.getTracks().forEach((t) => t.stop()); });
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const supabase = createClient();
    const path = `groups/${groupId}/voice_${Date.now()}.webm`;
    const { error } = await supabase.storage.from("chat-media").upload(path, blob, { upsert: false, contentType: "audio/webm" });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path);
      await sendMessage("", "voice", publicUrl);
    }
    setUploadingVoice(false);
    audioChunksRef.current = [];
  }

  return (
    <div className="flex flex-col h-[calc(100svh-3.5rem-2.5rem-env(safe-area-inset-top,0px))] max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 shrink-0">
        <button onClick={() => router.push("/messages")} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted -ml-1">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        {group && (
          <>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-extrabold">
              <span className="material-symbols-outlined text-[18px]">{group.type === "territory" ? "pin_drop" : "group"}</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-bold text-sm text-foreground leading-tight">{group.name}</span>
              <span className="text-xs text-muted-foreground">{group.member_count} member{group.member_count !== 1 ? "s" : ""}</span>
            </div>
          </>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">forum</span>
            <p className="text-sm font-semibold text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60">Start the conversation below</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_role === "owner";
          const senderName = msg.sender_member_id ? (memberNames[msg.sender_member_id] ?? "Team member") : "You";
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && <span className="text-[10px] text-primary font-semibold px-1">{senderName}</span>}
                {msg.message_type === "photo" && msg.media_url ? (
                  <img src={msg.media_url} alt="Photo" className="rounded-2xl max-w-[220px] max-h-48 object-cover cursor-pointer" onClick={() => window.open(msg.media_url!, "_blank")} />
                ) : msg.message_type === "voice" && msg.media_url ? (
                  <AudioPlayer src={msg.media_url} />
                ) : (
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                    {msg.content}
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground/50 px-1">{formatMsgTime(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pt-2 pb-3 border-t border-border/50 shrink-0">
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto || !group}
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40">
            {uploadingPhoto ? <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-[20px]">photo_camera</span>}
          </button>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) { sendMessage(text.trim()); setText(""); } } }}
            placeholder="Message the group…" rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }} />
          {text.trim() ? (
            <button onClick={() => { sendMessage(text.trim()); setText(""); }} disabled={sending}
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white disabled:opacity-40 active:scale-90 transition-all">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            </button>
          ) : (
            <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
              disabled={uploadingVoice || !group}
              className={`flex size-10 shrink-0 items-center justify-center rounded-2xl transition-all disabled:opacity-40 ${recording ? "bg-red-500 text-white scale-110" : "bg-muted text-muted-foreground"}`}>
              {uploadingVoice ? <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-[20px]" style={recording ? { fontVariationSettings: "'FILL' 1" } : {}}>mic</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
