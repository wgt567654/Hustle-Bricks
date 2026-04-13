"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EmployeePendingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // Fetch their pending team_member row + business name
      const { data: tm } = await supabase
        .from("team_members")
        .select("is_active, is_pending, businesses(name)")
        .eq("user_id", user.id)
        .single();

      if (!tm) {
        router.replace("/login");
        return;
      }

      // If they've been approved, send them to the employee portal
      if (tm.is_active) {
        router.replace("/employee");
        return;
      }

      const biz = tm.businesses as unknown as { name: string } | null;
      setBusinessName(biz?.name ?? null);
    }
    load();
  }, [router]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-5 text-center max-w-xs">
        <div className="flex size-20 items-center justify-center rounded-full icon-orange ">
          <span
            className="material-symbols-outlined text-[40px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            hourglass_top
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold text-foreground">Pending approval</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account request{businessName ? ` for ` : ""}
            {businessName && <strong>{businessName}</strong>}
            {" "}has been submitted. Your manager needs to approve you before you can access the app.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Check back after your manager confirms your access.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full mt-2">
          <button
            onClick={() => router.refresh()}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
          >
            Check again
          </button>
          <button
            onClick={signOut}
            className="w-full py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm hover:bg-muted/50 active:scale-95 transition-all"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
