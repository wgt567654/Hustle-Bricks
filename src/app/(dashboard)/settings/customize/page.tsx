import Link from "next/link";

const AREAS: {
  href: string;
  icon: string;
  iconClass: string;
  title: string;
  desc: string;
}[] = [
  {
    href: "/settings/customize/appearance",
    icon: "palette",
    iconClass: "icon-primary",
    title: "Appearance",
    desc: "Accent color, corners, density, glass effects, dark mode.",
  },
  {
    href: "/settings/customize/modules",
    icon: "grid_view",
    iconClass: "icon-violet",
    title: "Modules",
    desc: "Turn features on or off, reorder navigation, pin what matters.",
  },
  {
    href: "/settings/customize/statuses",
    icon: "label",
    iconClass: "icon-teal",
    title: "Statuses & Stages",
    desc: "Your own lead stages, job statuses, tags, and priorities.",
  },
  {
    href: "/settings/customize/fields",
    icon: "input",
    iconClass: "icon-sky",
    title: "Custom Fields",
    desc: "Gate codes, pets, roof pitch — unlimited fields on any record.",
  },
  {
    href: "/settings/customize/templates",
    icon: "edit_note",
    iconClass: "icon-orange",
    title: "Message Templates",
    desc: "Every automated text and email, in your words. Variables included.",
  },
  {
    href: "/settings/customize/automations",
    icon: "account_tree",
    iconClass: "icon-green",
    title: "Automation Builder",
    desc: "Visual follow-up sequences: book → confirm → remind → review.",
  },
  {
    href: "/settings/customize/ai",
    icon: "auto_awesome",
    iconClass: "icon-brick",
    title: "AI Personality",
    desc: "Set the assistant's tone and permanent instructions.",
  },
  {
    href: "/settings/customize/email",
    icon: "mail",
    iconClass: "icon-violet",
    title: "Email Branding",
    desc: "Logo, colors, signature, and disclaimers on every email.",
  },
  {
    href: "/settings/customize/quick-actions",
    icon: "bolt",
    iconClass: "icon-caution",
    title: "Quick Actions",
    desc: "Build your own shortcut bar for the things you do hourly.",
  },
  {
    href: "/settings/customize/export",
    icon: "swap_vert",
    iconClass: "icon-red",
    title: "Import & Export",
    desc: "Move your whole setup between locations or franchises.",
  },
  {
    href: "/settings/customize/industry",
    icon: "storefront",
    iconClass: "icon-green",
    title: "Industry Templates",
    desc: "One-tap setup tuned for your trade — fields, stages, and shortcuts.",
  },
];

export default function CustomizeStudioPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-6">
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Settings
        </Link>
        <h1 className="text-2xl">Customize Studio</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Your business. Your workflow. Your operating system. Shape
          HustleBricks around how your company actually works.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((a, i) => (
          <Link
            key={a.href}
            href={a.href}
            className="press reveal group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            style={{ "--reveal-i": i + 1 } as React.CSSProperties}
          >
            <div className={`flex size-10 items-center justify-center rounded-xl ${a.iconClass}`}>
              <span className="material-symbols-outlined text-[22px]">{a.icon}</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
