"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EmployeeJoinCompletePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function completeJoin() {
      const stored = localStorage.getItem("pending_employee_join");
      if (!stored) {
        router.replace("/employee-pending");
        return;
      }

      const { code, name } = JSON.parse(stored) as { code: string; name: string };
      const supabase = createClient();

      const { data, error } = await supabase.rpc("join_business_as_employee", {
        p_code: code,
        p_name: name,
      });

      localStorage.removeItem("pending_employee_join");

      if (error || data?.error) {
        setErrorMessage(data?.error ?? error?.message ?? "Failed to join team.");
        setStatus("error");
        return;
      }

      router.replace("/employee-pending");
    }

    completeJoin();
  }, [router]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2.5">
            {errorMessage}
          </p>
          <button
            onClick={() => router.push("/employee-join")}
            className="text-sm font-bold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Setting up your account…</p>
    </div>
  );
}
