"use client";

import { useState, useMemo, useEffect } from "react";

// ── Calendar helpers ──────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - firstDay.getDay());
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= lastDay || days.length % 7 !== 0) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSlot(slot: string) {
  const [h] = slot.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour} ${suffix}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Intent = "schedule" | "quote" | "contact";
type Step = "intent" | "info" | "details" | "done";

const SERVICE_OPTIONS = [
  "Exterior Wash","Interior Detail","Full Detail","Engine Bay",
  "Paint Correction","Ceramic Coating","Window Tint","Odor Removal",
  "Pressure Wash","Lawn Care","Cleaning","Painting","Other",
];

// ── Main component ────────────────────────────────────────────────────────────

export default function BookWidget({
  businessId,
  businessName,
  contactEmail,
  contactPhone,
  unavailableDays = [],
  dayHours = {},
  blockedDates = [],
}: {
  businessId: string;
  businessName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  unavailableDays?: number[];
  dayHours?: Record<string, { from: string; until: string }>;
  blockedDates?: string[];
}) {
  const [step, setStep] = useState<Step>("intent");
  const [intent, setIntent] = useState<Intent>("schedule");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contact info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Quote / contact details
  const [services, setServices] = useState<string[]>([]);
  const [propertyType, setPropertyType] = useState("");
  const [notes, setNotes] = useState("");

  // Booking calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slotCapacity, setSlotCapacity] = useState<Record<string, number> | null>(null);
  const [loadingCapacity, setLoadingCapacity] = useState(false);

  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  const todayKey = dateKey(new Date());

  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const calendarDays = useMemo(
    () => getCalendarDays(calYear, calMonthIdx),
    [calYear, calMonthIdx]
  );

  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dow = new Date(selectedDate + "T12:00:00").getDay();
    const config = dayHours[String(dow)] ?? { from: "08:00", until: "18:00" };
    const [fromH] = config.from.split(":").map(Number);
    const [untilH] = config.until.split(":").map(Number);
    return Array.from({ length: Math.max(0, untilH - fromH) }, (_, i) =>
      `${String(fromH + i).padStart(2, "0")}:00`
    );
  }, [selectedDate, dayHours]);

  // Reset time when date changes
  useEffect(() => { setSelectedTime(null); }, [selectedDate]);

  // Fetch slot capacity when a date is selected
  useEffect(() => {
    if (!selectedDate || intent !== "schedule") { setSlotCapacity(null); return; }
    setLoadingCapacity(true);
    fetch(`/api/booking/capacity?businessId=${businessId}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => { setSlotCapacity(data); setLoadingCapacity(false); })
      .catch(() => { setSlotCapacity(null); setLoadingCapacity(false); });
  }, [selectedDate, businessId, intent]);

  function toggleService(s: string) {
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    let url = "";
    let body: Record<string, unknown> = { business_id: businessId, name, email, phone, address };

    if (intent === "schedule") {
      url = "/api/booking/public";
      body = { ...body, date: selectedDate, time: selectedTime, notes };
    } else if (intent === "quote") {
      url = "/api/quotes/request";
      body = { ...body, services, property_type: propertyType, notes };
    } else {
      url = "/api/leads/submit";
      body = { ...body, notes, source: "Website" };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSubmitting(false);
    } else {
      setStep("done");
    }
  }

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (step === "done") {
    const messages: Record<Intent, { title: string; body: string }> = {
      schedule: {
        title: "Request sent!",
        body: `We received your booking request for ${selectedDate ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "your chosen date"}${selectedTime ? ` at ${formatSlot(selectedTime)}` : ""}. We'll be in touch to confirm.`,
      },
      quote: {
        title: "Quote request received!",
        body: "We'll review your request and get back to you with a quote soon.",
      },
      contact: {
        title: "Message received!",
        body: "Thanks for reaching out. We'll respond as soon as possible.",
      },
    };
    const msg = messages[intent];
    return (
      <div className="bg-green-50 border border-green-200 rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-green-600">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="font-extrabold text-green-800 text-lg">{msg.title}</p>
          <p className="text-sm text-green-700 mt-2 leading-relaxed">{msg.body}</p>
        </div>
        {(contactPhone || contactEmail) && (
          <div className="flex flex-col gap-2 w-full mt-2">
            {contactPhone && (
              <a href={`tel:${contactPhone}`} className="flex items-center justify-center gap-2 bg-green-100 hover:bg-green-200 transition-colors rounded-2xl py-3 text-green-800 text-sm font-bold">
                Call us: {contactPhone}
              </a>
            )}
            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="flex items-center justify-center gap-2 bg-green-100 hover:bg-green-200 transition-colors rounded-2xl py-3 text-green-800 text-sm font-bold">
                {contactEmail}
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Step: Intent ────────────────────────────────────────────────────────────
  if (step === "intent") {
    const options: { id: Intent; label: string; description: string; icon: React.ReactNode }[] = [
      {
        id: "schedule",
        label: "Schedule a Service",
        description: "Pick a date and time that works for you",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        id: "quote",
        label: "Get a Quote",
        description: "Tell us what you need, we'll send a price",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 14.25a.75.75 0 000 1.5H15a.75.75 0 000-1.5H9.75zm0-3a.75.75 0 000 1.5H15a.75.75 0 000-1.5H9.75z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        id: "contact",
        label: "Contact Us",
        description: "Ask a question or send a message",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
          </svg>
        ),
      },
    ];

    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 px-1">What can we help you with?</p>
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => { setIntent(opt.id); setStep("info"); }}
            className="bg-white border border-gray-200 rounded-3xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group text-left active:scale-[0.98]"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
              {opt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-gray-900 text-base">{opt.label}</p>
              <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-indigo-500 transition-colors">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        ))}
      </div>
    );
  }

  // ── Step: Info ──────────────────────────────────────────────────────────────
  if (step === "info") {
    const isValid = name.trim().length > 0 && (email.trim().length > 0 || phone.trim().length > 0);
    return (
      <div className="flex flex-col gap-5">
        <button onClick={() => setStep("intent")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back
        </button>

        <div className="bg-white border border-gray-200 rounded-3xl p-5 flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Your Info</p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600">Address <span className="font-normal text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {!isValid && (name.length > 0 || email.length > 0 || phone.length > 0) && (
            <p className="text-xs text-amber-600">Please enter your name and at least one way to reach you.</p>
          )}

          <button
            onClick={() => setStep("details")}
            disabled={!isValid}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Details ───────────────────────────────────────────────────────────
  const canSubmitSchedule = !!selectedDate && !!selectedTime;
  const canSubmitQuote = true;
  const canSubmitContact = notes.trim().length > 0;
  const canSubmit =
    intent === "schedule" ? canSubmitSchedule :
    intent === "quote" ? canSubmitQuote :
    canSubmitContact;

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => setStep("info")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back
      </button>

      {/* ── Schedule ── */}
      {intent === "schedule" && (
        <div className="bg-white border border-gray-200 rounded-3xl p-5 flex flex-col gap-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pick a Date & Time</p>

          {/* Month nav */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))} className="flex size-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-sm font-extrabold text-gray-900">{MONTHS[calMonthIdx]} {calYear}</span>
              <button onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))} className="flex size-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAYS_SHORT.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const isCurrentMonth = day.getMonth() === calMonthIdx;
                const isPast = key < todayKey;
                const isBlocked = blockedSet.has(key) || unavailableDays.includes(day.getDay());
                const isSelected = key === selectedDate;
                const isToday = key === todayKey;
                const isDisabled = isPast || !isCurrentMonth || isBlocked;
                return (
                  <button
                    key={key}
                    disabled={isDisabled}
                    onClick={() => setSelectedDate(key)}
                    className={`relative flex items-center justify-center h-9 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                      isBlocked ? "bg-red-50 text-red-300 cursor-not-allowed line-through" :
                      isSelected ? "bg-indigo-600 text-white shadow-sm" :
                      isToday ? "bg-indigo-50 text-indigo-600" :
                      isPast || !isCurrentMonth ? "text-gray-300 cursor-not-allowed" :
                      "text-gray-800 hover:bg-gray-100"
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
              {loadingCapacity ? (
                <p className="text-xs text-gray-400 text-center py-3">Checking availability…</p>
              ) : timeSlots.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">No availability on this day.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((slot) => {
                    const cap = slotCapacity !== null ? (slotCapacity[slot] ?? 0) : null;
                    const isFull = cap !== null && cap === 0;
                    const isLow = cap !== null && cap > 0 && cap <= 2;
                    const isSelected = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        disabled={isFull}
                        onClick={() => setSelectedTime(slot === selectedTime ? null : slot)}
                        className={`py-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex flex-col items-center gap-0.5 ${
                          isFull ? "bg-gray-100 text-gray-300 cursor-not-allowed line-through" :
                          isSelected ? "bg-indigo-600 text-white shadow-sm" :
                          "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {formatSlot(slot)}
                        {isLow && !isSelected && (
                          <span className="text-[9px] font-bold text-amber-500">{cap} left</span>
                        )}
                        {isFull && (
                          <span className="text-[9px] font-bold text-gray-400" style={{ textDecoration: "none" }}>Full</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600">Notes <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything we should know? Gate code, pets, specific areas…"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
        </div>
      )}

      {/* ── Quote ── */}
      {intent === "quote" && (
        <div className="bg-white border border-gray-200 rounded-3xl p-5 flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">What do you need?</p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600">Services</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleService(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    services.includes(s)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600">Property Type <span className="font-normal text-gray-400">(optional)</span></label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select…</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="vehicle">Vehicle</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600">Notes <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details that would help us give you an accurate quote…"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
        </div>
      )}

      {/* ── Contact ── */}
      {intent === "contact" && (
        <div className="bg-white border border-gray-200 rounded-3xl p-5 flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Your Message</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Hi ${businessName}, I'd like to ask about…`}
            rows={5}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>
      )}

      {/* Summary + submit */}
      <div className="flex flex-col gap-3">
        {selectedDate && selectedTime && intent === "schedule" && (
          <div className="bg-indigo-50 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-1">Your Request</p>
            <p className="font-extrabold text-gray-900">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">{formatSlot(selectedTime)}</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-lg shadow-indigo-200"
        >
          {submitting ? "Sending…" :
            intent === "schedule" ? "Request This Time" :
            intent === "quote" ? "Send Quote Request" :
            "Send Message"}
        </button>
      </div>
    </div>
  );
}
