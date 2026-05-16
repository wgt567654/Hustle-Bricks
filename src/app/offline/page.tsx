"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="flex size-20 items-center justify-center rounded-full bg-blue-100">
        <svg className="w-9 h-9 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
        </svg>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-extrabold text-gray-900">You&apos;re offline</h1>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          Check your internet connection. Any pages you&apos;ve visited recently are still available.
        </p>
      </div>

      <div className="w-full max-w-xs rounded-2xl bg-white border border-gray-200 shadow-sm p-4 text-left flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Available offline</p>
        {[
          { icon: "work", label: "Jobs you've viewed" },
          { icon: "group", label: "Clients you've viewed" },
          { icon: "calendar_month", label: "Your schedule" },
          { icon: "request_quote", label: "Recent quotes" },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-2.5 text-sm text-gray-700">
            <span className="material-symbols-outlined text-[16px] text-blue-500">{icon}</span>
            {label}
          </div>
        ))}
      </div>

      <button
        onClick={() => window.location.reload()}
        className="mt-1 px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm active:scale-[0.98] transition-all"
      >
        Try again
      </button>

      <p className="text-xs text-gray-400">HustleBricks</p>
    </div>
  );
}
