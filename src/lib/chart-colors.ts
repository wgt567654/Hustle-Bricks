// Resolved hex values matching the app's design system CSS variables.
// Recharts SVG elements (stroke, fill) require resolved hex — CSS vars don't work in SVG attributes.
// For non-SVG Recharts elements (Tooltip), use CSS vars via contentStyle/style props instead.
export const CHART_COLORS = {
  blue:   "#007AFF", // --primary (iOS blue)
  green:  "#16a34a", // success / completed
  orange: "#ea580c", // warning / in-progress
  purple: "#8b5cf6", // accent
  yellow: "#f59e0b", // caution
  muted:  "#6b7280", // --muted-foreground
  red:    "#ef4444", // error / lost
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;

// Ordered palette for multi-series charts
export const CHART_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.orange,
  CHART_COLORS.purple,
  CHART_COLORS.yellow,
] as const;
