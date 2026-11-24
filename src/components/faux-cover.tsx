/**
 * Typographic book covers for marketing surfaces and as a fallback when a
 * title has no artwork. Drawn in SVG/CSS so they are crisp, theme-safe and
 * never depend on a third-party image host being reachable.
 */
import type { FauxBook } from "@/lib/faux-books";

function Motif({ motif, color }: { motif: FauxBook["motif"]; color: string }) {
  const common = { fill: "none", stroke: color, strokeWidth: 1.4, opacity: 0.85 } as const;
  switch (motif) {
    case "circle":
      return <circle cx="50" cy="62" r="18" {...common} />;
    case "arc":
      return <path d="M22 80a28 28 0 0 1 56 0" {...common} />;
    case "diamond":
      return <path d="M50 42 70 62 50 82 30 62Z" {...common} />;
    case "wave":
      return (
        <path
          d="M18 62c8-8 16 8 24 0s16 8 24 0 16 8 16 0M18 72c8-8 16 8 24 0s16 8 24 0 16 8 16 0"
          {...common}
        />
      );
    case "stripes":
      return (
        <g {...common}>
          <path d="M20 54h60M20 62h60M20 70h60" />
        </g>
      );
    case "frame":
    default:
      return <rect x="16" y="14" width="68" height="122" rx="2" {...common} />;
  }
}

export function FauxCover({
  book,
  className = "",
  showText = true,
  padTop = false,
}: {
  book: FauxBook;
  className?: string;
  showText?: boolean;
  /** Leaves room at the top for overlaid badges (status, favourite). */
  padTop?: boolean;
}) {
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[6px] ${className}`}
      style={{
        background: `linear-gradient(160deg, ${book.bg}, color-mix(in oklab, ${book.bg} 78%, black))`,
        color: book.fg,
        containerType: "inline-size",
        boxShadow:
          "inset 3px 0 0 rgb(255 255 255 / 0.08), inset 7px 0 10px -6px rgb(0 0 0 / 0.45), 0 24px 40px -22px rgb(10 20 40 / 0.6)",
      }}
      role="img"
      aria-label={`${book.title}, de ${book.author}`}
    >
      <svg viewBox="0 0 100 150" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <Motif motif={book.motif} color={book.accent} />
      </svg>
      {showText && (
        <div
          className={`absolute inset-0 flex flex-col justify-between p-[9%] ${padTop ? "pt-[26%]" : ""}`}
        >
          <p
            lang="pt-BR"
            className="font-display font-semibold leading-[1.08] [hyphens:auto] [overflow-wrap:anywhere]"
            style={{ fontSize: "clamp(0.55rem, 12.5cqw, 1.5rem)" }}
          >
            {book.title}
          </p>
          <p
            className="font-medium uppercase leading-tight tracking-[0.12em] opacity-80"
            style={{ fontSize: "clamp(0.4rem, 6.5cqw, 0.62rem)" }}
          >
            {book.author}
          </p>
        </div>
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(105deg, rgb(255 255 255 / 0.14), transparent 38%)" }}
      />
    </div>
  );
}
