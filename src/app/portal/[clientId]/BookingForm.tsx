"use client";

import { useState, useMemo, useEffect } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// TIME_SLOTS are now dynamic based on business hours passed as props

function formatSlot(slot: string) {
  const [h] = slot.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour} ${suffix}`;
}

type BookingStatus = {
  id: string;
  status: "pending" | "declined";
  requested_date: string;
  requested_time: string;
};

function formatDateLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

export function BookingForm({
  clientId,
  businessId,
  latestRequest,
  blockedDates = [],
  unavailableDays = [],
  dayHours = {},
}: {
  clientId: string;
  businessId: string;
  latestRequest?: BookingStatus | null;
  blockedDates?: string[];
  unavailableDays?: number[];
  dayHours?: Record<string, { from: string; until: string }>;
}) {
  const isDeclined = latestRequest?.status === "declined";
  const isPending = latestRequest?.status === "pending";
  const blockedSet = new Set(blockedDates);

  const [open, setOpen] = useState(isDeclined);
  const [submitted, setSubmitted] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Reset time when date changes
  useEffect(() => { setSelectedTime(null); }, [selectedDate]);

  // Time slots based on the selected day's hours
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dow = new Date(selectedDate + "T12:00:00").getDay();
    const config = dayHours[dow] ?? { from: "08:00", until: "18:00" };
    const [fromH] = config.from.split(":").map(Number);
    const [untilH] = config.until.split(":").map(Number);
    return Array.from({ length: Math.max(0, untilH - fromH) }, (_, i) =>
      `${String(fromH + i).padStart(2, "0")}:00`
    );
  }, [selectedDate, dayHours]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
  const todayKey = dateKey(new Date());

  async function handleSubmit() {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        businessId,
        date: selectedDate,
        time: selectedTime,
        notes: notes.trim() || null,
      }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSubmitting(false);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-3xl p-6 flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-green-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-green-600">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="font-extrabold text-green-800 text-base">Request sent!</p>
          <p className="text-sm text-green-700 mt-1">
            We received your request for{" "}
            <strong>
              {new Date(selectedDate! + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </strong>{" "}
            at <strong>{formatSlot(selectedTime!)}</strong>.
          </p>
          <p className="text-xs text-green-600 mt-2">
            We&apos;ll be in touch to confirm your appointment.
          </p>
        </div>
      </div>
    );
  }

  // Pending — waiting on business to confirm
  if (isPending && !open) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-600">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-amber-800 text-sm">Appointment request pending</p>
          <p className="text-xs text-amber-700 mt-0.5">
            {formatDateLabel(latestRequest!.requested_date)} · {formatSlot(latestRequest!.requested_time)}
          </p>
          <p className="text-xs text-amber-600 mt-1">We&apos;ll confirm your time soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
      {/* Declined notice — shown above the form */}
      {isDeclined && (
        <div className="px-5 pt-5">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 mb-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-600">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-extrabold text-red-800 text-sm">That time isn&apos;t available</p>
              <p className="text-xs text-red-700 mt-0.5">
                {formatDateLabel(latestRequest!.requested_date)} · {formatSlot(latestRequest!.requested_time)}
              </p>
              <p className="text-xs text-red-600 mt-1">Please pick a different date or time below.</p>
            </div>
          </div>
        </div>
      )}

      {/* Header button — only shown when not declined (declined auto-opens) */}
      {!isDeclined && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-primary">
              <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex flex-col flex-1 text-left">
            <span className="font-extrabold text-gray-900 text-sm">Schedule a Service</span>
            <span className="text-xs text-gray-500">Request an appointment time</span>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {open && (
        <div className="border-t border-gray-100 px-5 pt-5 pb-6 flex flex-col gap-5">

          {/* Month nav + mini calendar */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="flex size-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-sm font-extrabold text-gray-900">
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="flex size-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7">
              {DAYS_SHORT.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px">
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const isCurrentMonth = day.getMonth() === month;
                const isPast = key < todayKey;
                const isBlocked = blockedSet.has(key) || unavailableDays.includes(day.getDay());
                const isSelected = key === selectedDate;
                const isToday = key === todayKey;
                const isDisabled = isPast || !isCurrentMonth || isBlocked;

                return (
                  <button
                    key={key}
                    disabled={isDisabled}
                    title={isBlocked ? "Not available" : undefined}
                    onClick={() => setSelectedDate(key)}
                    className={`relative flex items-center justify-center h-9 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                      isBlocked
                        ? "bg-red-50 text-red-300 cursor-not-allowed line-through"
                        : isSelected
                        ? "bg-primary text-white shadow-sm"
                        : isToday
                        ? "bg-primary/10 text-primary"
                        : isPast || !isCurrentMonth
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Pick a Time</p>
              <div className="grid grid-cols-5 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot === selectedTime ? null : slot)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                      selectedTime === slot
                        ? "bg-primary text-white shadow-sm"
                        : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {formatSlot(slot)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {selectedDate && selectedTime && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Notes <span className="normal-case font-normal text-gray-400">(optional)</span>
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything we should know? (e.g. gate code, pets, specific areas)"
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
              />
            </div>
          )}

          {/* Summary + submit */}
          {selectedDate && selectedTime && (
            <div className="flex flex-col gap-3">
              <div className="bg-primary/5 rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Your Request</p>
                <p className="font-extrabold text-gray-900">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{formatSlot(selectedTime)}</p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-primary text-white font-extrabold text-sm hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
              >
                {submitting ? "Sending request…" : "Request This Time"}
              </button>
            </div>
          )}

          {!selectedDate && (
            <p className="text-xs text-gray-400 text-center">Select a date above to see available times</p>
          )}
        </div>
      )}
    </div>
  );
}
