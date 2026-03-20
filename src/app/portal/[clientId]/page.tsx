import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { BookingForm } from "./BookingForm";

type Job = {
  id: string;
  status: string;
  total: number;
  scheduled_at: string | null;
  notes: string | null;
  payments: { id: string; status: string }[];
};

type ClientData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  business_id: string;
  businesses: {
    name: string;
    contact_email: string | null;
    contact_phone: string | null;
  } | null;
  jobs: Job[];
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: requestsData }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, email, phone, address, business_id, businesses(name, contact_email, contact_phone), jobs(id, status, total, scheduled_at, notes, payments(id, status))"
      )
      .eq("id", clientId)
      .single(),
    supabase
      .from("booking_requests")
      .select("id, status, requested_date, requested_time")
      .eq("client_id", clientId)
      .in("status", ["pending", "declined"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  // Fetch blocked dates and scheduling settings after we have the business_id
  let blockedDates: string[] = [];
  let unavailableDays: number[] = [];
  let dayHours: Record<string, { from: string; until: string }> = {};
  if (data) {
    const bid = (data as { business_id: string }).business_id;
    const [{ data: blocked }, { data: settings }] = await Promise.all([
      supabase.from("blocked_dates").select("blocked_date").eq("business_id", bid),
      supabase.from("scheduling_settings").select("unavailable_days, day_hours").eq("business_id", bid).maybeSingle(),
    ]);
    blockedDates = (blocked ?? []).map((r: { blocked_date: string }) => r.blocked_date);
    if (settings) {
      unavailableDays = settings.unavailable_days ?? [];
      dayHours = settings.day_hours ?? {};
    }
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4 px-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-8 h-8 text-gray-400"
            >
              <path
                fillRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Portal not found</h1>
          <p className="text-sm text-gray-500">
            This link may be invalid. Contact the business for a new link.
          </p>
        </div>
      </div>
    );
  }

  const client = data as unknown as ClientData;
  const latestRequest = (requestsData?.[0] ?? null) as {
    id: string; status: "pending" | "declined"; requested_date: string; requested_time: string;
  } | null;
  const jobs = (client.jobs ?? []).sort((a, b) => {
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
  });

  const unpaidJobs = jobs.filter(
    (j) => !j.payments?.some((p) => p.status === "paid")
  );
  const paidJobs = jobs.filter((j) =>
    j.payments?.some((p) => p.status === "paid")
  );

  const totalOwed = unpaidJobs.reduce((sum, j) => sum + j.total, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-lg mx-auto px-5 py-8 pb-16">

        {/* Business header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
            {client.businesses?.name ?? "Your Service Provider"}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Your Account
          </h1>
        </div>

        {/* Client card */}
        <div className="bg-white rounded-3xl border border-gray-200 p-5 mb-6 flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#007AFF]/10 text-[#007AFF] font-extrabold text-lg border border-[#007AFF]/20">
            {getInitials(client.name)}
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <h2 className="font-extrabold text-lg text-gray-900 leading-tight truncate">
              {client.name}
            </h2>
            {client.phone && (
              <p className="text-sm text-gray-500 truncate">{client.phone}</p>
            )}
            {client.email && (
              <p className="text-sm text-gray-500 truncate">{client.email}</p>
            )}
          </div>
        </div>

        {/* Balance summary */}
        {totalOwed > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 mb-6 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
                Balance Due
              </p>
              <p className="text-3xl font-extrabold text-amber-800">
                ${totalOwed.toFixed(2)}
              </p>
              <p className="text-xs text-amber-600">
                {unpaidJobs.length} unpaid invoice{unpaidJobs.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-7 h-7 text-amber-600"
              >
                <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
                <path
                  fillRule="evenodd"
                  d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        )}

        {totalOwed === 0 && jobs.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-3xl p-5 mb-6 flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 text-green-600"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold text-green-800">All paid up!</p>
              <p className="text-sm text-green-700">No outstanding balance.</p>
            </div>
          </div>
        )}

        {/* Unpaid invoices */}
        {unpaidJobs.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">
              Outstanding
            </p>
            <div className="flex flex-col gap-3">
              {unpaidJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/invoice/${job.id}`}
                  className="bg-white rounded-2xl border border-amber-200 p-4 flex items-center justify-between group hover:border-amber-400 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Unpaid
                      </span>
                    </div>
                    {job.scheduled_at && (
                      <p className="text-sm font-medium text-gray-600">
                        {formatDate(job.scheduled_at)}
                      </p>
                    )}
                    {job.notes && (
                      <p className="text-xs text-gray-400 line-clamp-1">{job.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-gray-900">
                        ${job.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-amber-600 font-medium">Tap to pay</p>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Paid invoices */}
        {paidJobs.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">
              Payment History
            </p>
            <div className="flex flex-col gap-3">
              {paidJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/invoice/${job.id}`}
                  className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between group hover:border-gray-300 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Paid
                      </span>
                    </div>
                    {job.scheduled_at && (
                      <p className="text-sm font-medium text-gray-600">
                        {formatDate(job.scheduled_at)}
                      </p>
                    )}
                    {job.notes && (
                      <p className="text-xs text-gray-400 line-clamp-1">{job.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-extrabold text-gray-400">
                      ${job.total.toFixed(2)}
                    </p>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {jobs.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-8 h-8 text-gray-300"
              >
                <path
                  fillRule="evenodd"
                  d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zm6.905 9.97a.75.75 0 00-1.06 0l-3 3a.75.75 0 101.06 1.06l1.72-1.72V18a.75.75 0 001.5 0v-4.19l1.72 1.72a.75.75 0 101.06-1.06l-3-3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No invoices yet</p>
            <p className="text-xs text-gray-400">
              Your invoices will appear here once created.
            </p>
          </div>
        )}

        {/* Booking form */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">
            Schedule
          </p>
          <BookingForm
            clientId={client.id}
            businessId={client.business_id}
            latestRequest={latestRequest}
            blockedDates={blockedDates}
            unavailableDays={unavailableDays}
            dayHours={dayHours}
          />
        </div>

        {/* Contact section */}
        {(client.businesses?.contact_email || client.businesses?.contact_phone) && (
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Questions? Contact Us
              </p>
            </div>
            <div className="flex flex-col divide-y divide-gray-100">
              {client.businesses.contact_email && (
                <a
                  href={`mailto:${client.businesses.contact_email}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-gray-500"
                    >
                      <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                      <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                    </svg>
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-900 text-sm">Email Us</span>
                    <span className="text-xs text-gray-500">
                      {client.businesses.contact_email}
                    </span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              )}
              {client.businesses.contact_phone && (
                <a
                  href={`tel:${client.businesses.contact_phone}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-gray-500"
                    >
                      <path
                        fillRule="evenodd"
                        d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-900 text-sm">Call Us</span>
                    <span className="text-xs text-gray-500">
                      {client.businesses.contact_phone}
                    </span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-bold text-gray-500">HustleBricks</span>
          </p>
        </div>
      </div>
    </div>
  );
}
