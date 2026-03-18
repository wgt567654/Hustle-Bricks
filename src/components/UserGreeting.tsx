"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function UserGreeting() {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const fullName = user.user_metadata?.full_name as string | undefined;
        const name = fullName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "friend";
        setFirstName(name);
      }
    });
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground font-medium">{greeting}</span>
      <h2 className="text-foreground text-lg font-bold leading-tight tracking-tight">
        Ready to hustle, {firstName ?? "…"}?
      </h2>
    </div>
  );
}
