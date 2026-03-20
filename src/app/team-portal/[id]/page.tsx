"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MemberRow = {
  id: string;
  name: string;
  email: string | null;
  user_id: string | null;
};

export default function TeamPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [member, setMember] = useState<MemberRow | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "unclaimed" | "claimed" | "not_found">("loading");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email, user_id")
        .eq("id", id)
        .single();

      if (error || !data) {
        setLoadState("not_found");
        return;
      }

      setMember(data);
      if (data.user_id) {
        setLoadState("claimed");
      } else {
        setEmail(data.email ?? "");
        setLoadState("unclaimed");
      }
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: member.name } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      // Email confirmation required — account created but no session yet
      setDone(true);
      setSubmitting(false);
      return;
    }

    // Claim the team_members row
    const { error: updateError } = await supabase
      .from("team_members")
      .update({ user_id: userId })
      .eq("id", member.id)
      .is("user_id", null);

    if (updateError) {
      setError("Account created but failed to link to your team record. Contact your manager.");
      setSubmitting(false);
      return;
    }

    router.replace("/");
  }

  if (loadState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (loadState === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">link_off</span>
          <h1 className="text-xl font-extrabold text-foreground">Link not found</h1>
          <p className="text-sm text-muted-foreground">This invite link is invalid or has expired. Ask your manager to share a new one.</p>
        </div>
      </div>
    );
  }

  if (loadState === "claimed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="flex size-16 items-center justify-center rounded-full bg-[#16a34a]/10 text-[#16a34a]">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Already set up</h1>
          <p className="text-sm text-muted-foreground">This account has already been claimed. Log in with your email and password.</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full mt-2 py-3 rounded-xl bg-[#007AFF] text-white font-bold text-sm hover:bg-[#007AFF]/90 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="flex size-16 items-center justify-center rounded-full bg-[#007AFF]/10 text-[#007AFF]">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then log in.</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full mt-2 py-3 rounded-xl bg-[#007AFF] text-white font-bold text-sm hover:bg-[#007AFF]/90 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#007AFF]/10 border border-[#007AFF]/20 text-[#007AFF]">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Join your team</h1>
            <p className="text-sm text-muted-foreground mt-1">Set up your HustleBricks account, <strong>{member?.name}</strong></p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2.5">{error}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Name</label>
            <input
              type="text"
              value={member?.name ?? ""}
              readOnly
              className="flex h-12 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="your@email.com"
              className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="At least 6 characters"
              className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat your password"
              className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !email || !password || !confirmPassword}
            className="w-full mt-2 py-3.5 rounded-xl bg-[#007AFF] text-white font-bold text-sm shadow-md shadow-[#007AFF]/30 hover:bg-[#007AFF]/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating account…" : "Create Account & Join"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <button type="button" onClick={() => router.push("/login")} className="font-bold text-[#007AFF] hover:underline">
              Log in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
