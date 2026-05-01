function BrickMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-xl bg-primary"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg
        viewBox="0 0 22 13"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: size * 0.75, height: "auto" }}
      >
        <rect x="0"  y="0"   width="9"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
        <rect x="11" y="0"   width="11" height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
        <rect x="0"  y="7.5" width="5"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
        <rect x="7"  y="7.5" width="9"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
        <rect x="18" y="7.5" width="4"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
      </svg>
    </div>
  );
}

const MARKS = Array.from({ length: 8 });

export function BrickLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-10 select-none">

      {/* Brand mark + wordmark */}
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse" style={{ animationDuration: "2s" }}>
          <BrickMark size={64} />
        </div>
        <p
          className="text-[15px] font-extrabold uppercase tracking-[0.14em] text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Hustle Bricks
        </p>
        <p className="text-xs text-muted-foreground tracking-wide">Loading…</p>
      </div>

      {/* Scrolling marquee */}
      <div
        className="w-full overflow-hidden py-1"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
          maskImage:
            "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
        }}
      >
        <div className="animate-scroll-bricks">
          {/* Two identical sets for seamless loop */}
          {[...MARKS, ...MARKS].map((_, i) => (
            <div key={i} className="mx-3 opacity-70">
              <BrickMark size={36} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
