import { languageLabel } from "@/lib/public-domain";

/**
 * The book's language, readable at a glance: Portuguese in green, English
 * in blue, anything else neutral. `corner` sits on top of a cover.
 */
export function LangTag({
  code,
  variant = "pill",
  short = false,
  className = "",
}: {
  code: string | null | undefined;
  variant?: "pill" | "corner";
  short?: boolean;
  className?: string;
}) {
  if (!code) return null;
  const c = code.toLowerCase().slice(0, 2);
  const tone =
    c === "pt"
      ? "bg-[#e2f3e8] text-[#1c6b45] dark:bg-[#173a28] dark:text-[#8fe0b4]"
      : c === "en"
        ? "bg-[#e5edfb] text-[#2b4f99] dark:bg-[#1b2a48] dark:text-[#a9c4ff]"
        : "bg-surface-2 text-muted-foreground";
  const label = short ? c.toUpperCase() : languageLabel(c);
  if (variant === "corner") {
    return (
      <span
        className={`pointer-events-none absolute left-1.5 top-1.5 z-[2] rounded-full px-1.5 py-[1px] text-[9.5px] font-bold tracking-wide shadow-sm ring-1 ring-black/5 ${tone} ${className}`}
        title={languageLabel(c)}
      >
        {c.toUpperCase()}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-[2px] text-[11px] font-bold leading-tight ${tone} ${className}`}
      title={`Idioma: ${languageLabel(c)}`}
    >
      {label}
    </span>
  );
}
