import { cn } from "@/lib/utils";

/**
 * Teaching empty state — explains what lives here and offers the first step,
 * instead of a bare "nothing here". Icon names are Material Symbols (already
 * loaded app-wide).
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className
      )}
    >
      <div className="icon-brick flex size-12 items-center justify-center rounded-2xl">
        <span className="material-symbols-outlined text-[26px]">{icon}</span>
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
