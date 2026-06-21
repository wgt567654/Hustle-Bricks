import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PaymentsClient from "./PaymentsClient";

type Payment = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "refunded";
  paid_at: string | null;
  method: string | null;
  created_at: string;
};

type JobWithPayment = {
  id: string;
  total: number;
  completed_at: string | null;
  created_at: string;
  clients: { name: string; phone: string | null } | null;
  job_line_items: { description: string }[];
  payment: Payment | null;
};

export default async function PaymentsPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, currency")
    .eq("owner_id", userId)
    .single();

  if (!business) redirect("/");

  const businessId = business.id as string;
  const currency = (business.currency as string | null) ?? "USD";

  const { data: jobsData } = await supabase
    .from("jobs")
    .select("id, total, completed_at, created_at, clients(name, phone), job_line_items(description)")
    .eq("business_id", businessId)
    .in("status", ["completed", "in_progress"])
    .order("completed_at", { ascending: false, nullsFirst: false });

  let jobs: JobWithPayment[] = [];

  if (jobsData) {
    const jobIds = jobsData.map((j) => j.id);
    const { data: paymentsData } = jobIds.length > 0
      ? await supabase
          .from("payments")
          .select("id, job_id, amount, status, paid_at, method, created_at")
          .in("job_id", jobIds)
      : { data: [] };

    const paymentsByJob = Object.fromEntries(
      (paymentsData ?? []).map((p: Payment & { job_id: string }) => [p.job_id, p])
    );

    jobs = jobsData.map((j) => ({
      ...j,
      clients: j.clients as unknown as { name: string; phone: string | null } | null,
      job_line_items: (j.job_line_items as { description: string }[]) ?? [],
      payment: paymentsByJob[j.id] ?? null,
    }));
  }

  return (
    <PaymentsClient
      initialJobs={jobs}
      initialBusinessId={businessId}
      initialCurrency={currency}
    />
  );
}
