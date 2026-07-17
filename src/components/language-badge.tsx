import { primaryLanguageLabel } from "@/lib/public-domain";

/** Overlay badge for a book cover showing its language — place inside a
 * `relative` wrapper around the cover image/placeholder. */
export function LanguageBadge({ languages }: { languages: string[] | undefined }) {
  if (!languages?.length) return null;
  return (
    <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground/80 ring-1 ring-border/60 backdrop-blur-sm">
      {primaryLanguageLabel(languages)}
    </span>
  );
}
