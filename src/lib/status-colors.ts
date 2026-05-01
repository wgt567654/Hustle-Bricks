/**
 * Single source of truth for all status and chart hex colors.
 *
 * Hex values are required for contexts where CSS variables cannot be used:
 * - Recharts SVG attributes (stroke, fill, activeDot)
 * - Leaflet map marker pins
 * - HTML email templates
 *
 * These values must match the CSS variables defined in globals.css.
 * When updating the palette, update both this file AND globals.css.
 */

export const STATUS_HEX = {
  scheduled:   "#2E6A8E",  // --color-status-scheduled  (steel blue)
  in_progress: "#EA580C",  // --color-status-in-progress (orange)
  completed:   "#16A34A",  // --color-status-completed   (green)
  cancelled:   "#6B7280",  // --color-status-cancelled   (gray)
  draft:       "#6B7280",  // --color-status-draft       (gray)
  sent:        "#2E6A8E",  // --color-status-sent        (steel blue)
  accepted:    "#16A34A",  // --color-status-accepted    (green)
  declined:    "#DC2626",  // --color-status-declined    (red)
} as const;

export type JobStatus   = "scheduled" | "in_progress" | "completed" | "cancelled";
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";
export type AnyStatus   = JobStatus | QuoteStatus;

/**
 * CSS class names for DOM badge/pill contexts.
 * These reference the utility classes defined in globals.css @layer utilities.
 */
export const STATUS_CLASS: Record<AnyStatus, string> = {
  scheduled:   "status-scheduled",
  in_progress: "status-in-progress",
  completed:   "status-completed",
  cancelled:   "status-cancelled",
  draft:       "status-draft",
  sent:        "status-sent",
  accepted:    "status-accepted",
  declined:    "status-declined",
};

export const CHART_COLORS = {
  blue:    "#2E6A8E",  // primary steel blue
  green:   "#16A34A",
  orange:  "#EA580C",
  violet:  "#8B5CF6",
  amber:   "#F59E0B",
  muted:   "#6B7280",
  red:     "#DC2626",
  teal:    "#14B8A6",
  sky:     "#0EA5E9",
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;

export const CHART_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.orange,
  CHART_COLORS.violet,
  CHART_COLORS.amber,
] as const;
