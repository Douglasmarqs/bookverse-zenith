import type { CatalogSource } from "@/lib/catalog";

export const SOURCE_BADGE: Record<CatalogSource, { short: string; bg: string; hint: string }> = {
  gutenberg: { short: "PG", bg: "#2b2b2b", hint: "75 mil+ livros · EPUB" },
  wikisource: { short: "W", bg: "#5a5a5a", hint: "Textos em português · EPUB" },
  standard: { short: "SE", bg: "#0f6f6f", hint: "Edições caprichadas · EPUB" },
  archive: { short: "IA", bg: "#1c1c1c", hint: "Digitalizações antigas · EPUB" },
};

export function SourceBadge({ source, size = 44 }: { source: CatalogSource; size?: number }) {
  const b = SOURCE_BADGE[source];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[14px] font-display text-white"
      style={{ width: size, height: size, background: b.bg, fontSize: size * 0.34 }}
    >
      {b.short}
    </span>
  );
}
