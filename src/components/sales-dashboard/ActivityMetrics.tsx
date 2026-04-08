"use client";

import { Card } from "@/components/ui/card";

// Mock activity data — replace with real data when an activities table is added
const MOCK_ACTIVITY = {
  calls:    24,
  emails:   41,
  meetings:  8,
};

type ActivityItem = {
  icon: string;
  label: string;
  count: number;
  color: string;
};

const ITEMS: ActivityItem[] = [
  { icon: "call",   label: "Calls",    count: MOCK_ACTIVITY.calls,    color: "#007AFF" },
  { icon: "mail",   label: "Emails",   count: MOCK_ACTIVITY.emails,   color: "#8b5cf6" },
  { icon: "groups", label: "Meetings", count: MOCK_ACTIVITY.meetings, color: "#16a34a" },
];

export function ActivityMetrics() {
  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: "var(--color-status-completed)", fontVariationSettings: "'FILL' 1" }}
          >
            timeline
          </span>
          <h3 className="text-sm font-extrabold">Activity</h3>
        </div>
        <span className="text-xs text-muted-foreground italic">Sample data · this month</span>
      </div>

      <div className="grid grid-cols-3 divide-x">
        {ITEMS.map((item) => (
          <div key={item.label} className="p-4 flex flex-col items-center gap-1 text-center">
            <span
              className="material-symbols-outlined text-[24px]"
              style={{ color: item.color, fontVariationSettings: "'FILL' 1" }}
            >
              {item.icon}
            </span>
            <p className="text-2xl font-extrabold">{item.count}</p>
            <p className="text-[11px] text-muted-foreground font-medium">{item.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
