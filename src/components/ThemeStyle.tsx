import { themeToCssVars, type ThemeSettings } from "@/lib/customization";

/**
 * Server-rendered theme override — zero flash, no client JS.
 * Emits the business's theme as CSS variables on :root; when glass is off,
 * also solidifies the frosted surfaces (mirrors html[data-glass="off"] rules
 * used by the client-side live preview).
 */
export default function ThemeStyle({ theme }: { theme: ThemeSettings }) {
  const glassOff = theme.glass
    ? ""
    : `.chrome,.glass-panel,.glass-sheet{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--card);}`;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root{${themeToCssVars(theme)}}${glassOff}`,
      }}
    />
  );
}
